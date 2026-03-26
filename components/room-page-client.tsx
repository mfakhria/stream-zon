"use client";

import { useRouter } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useTransition,
} from "react";
import {
  Check,
  Copy,
  Crown,
  Maximize2,
  MessageSquare,
  Mic,
  MicOff,
  Monitor,
  MonitorOff,
  Phone,
  Send,
  Signal,
  Tv2,
  Users,
  Video,
  VideoOff,
  X,
} from "lucide-react";
import { io, type Socket } from "socket.io-client";

import { QUALITY_BITRATES, QUALITY_OPTIONS, QUALITY_PRESETS } from "@/lib/constants";
import { getSignalingUrl } from "@/lib/env";
import type {
  AppErrorPayload,
  ChatMessage,
  ClientToServerEvents,
  InboundAnswerPayload,
  InboundIcePayload,
  InboundOfferPayload,
  Participant,
  QualityPresetKey,
  RoomRole,
  RoomState,
  ServerToClientEvents,
} from "@/lib/types";
import {
  PeerManager,
  attachLocalStream,
  stopMediaStream,
} from "@/lib/webrtc/peer-manager";

type SocketClient = Socket<ServerToClientEvents, ClientToServerEvents>;

type RoomPageClientProps = {
  roomCode: string;
  initialName: string;
  initialRole: RoomRole | null;
  iceServers: RTCIceServer[];
};

type PanelTab = "participants" | "chat";
type PeerStatusMap = Record<string, RTCPeerConnectionState | "idle" | "live">;

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function formatMessageTime(createdAt: number): string {
  const diff = Date.now() - createdAt;

  if (diff < 60_000) {
    return "Just now";
  }

  return new Intl.DateTimeFormat("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(createdAt);
}

function buildDefaultName(role: RoomRole | null): string {
  return role === "host" ? "Streamer" : "Viewer";
}

function getHostParticipant(participants: Participant[]): Participant | undefined {
  return participants.find((participant) => participant.role === "host");
}

async function copyText(value: string): Promise<void> {
  if (!navigator.clipboard?.writeText) {
    throw new Error("Clipboard copy is not available in this browser.");
  }

  await navigator.clipboard.writeText(value);
}

async function openVideoFullscreen(videoElement: HTMLVideoElement | null): Promise<void> {
  if (!videoElement) {
    throw new Error("No active video is available for fullscreen.");
  }

  if (!videoElement.requestFullscreen) {
    throw new Error("Fullscreen is not supported in this browser.");
  }

  await videoElement.requestFullscreen();
}

async function captureDisplayStream(
  presetKey: QualityPresetKey,
): Promise<{ stream: MediaStream; hasAudioTrack: boolean }> {
  if (typeof window === "undefined") {
    throw new Error("Screen sharing is only available in the browser.");
  }

  const getDisplayMedia = navigator.mediaDevices?.getDisplayMedia?.bind(
    navigator.mediaDevices,
  );

  if (!getDisplayMedia) {
    if (!window.isSecureContext) {
      throw new Error(
        "Screen sharing requires HTTPS or localhost. Open Streamzon from a secure browser context and try again.",
      );
    }

    throw new Error(
      "This browser does not expose screen sharing. Try the latest Chromium-based browser.",
    );
  }

  const config = QUALITY_PRESETS[presetKey];
  const constraints: DisplayMediaStreamOptions = {
    video: {
      width: { ideal: config.width },
      height: { ideal: config.height },
      frameRate: { ideal: config.frameRate },
    },
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
  };

  const stream = await getDisplayMedia(constraints);

  return {
    stream,
    hasAudioTrack: stream.getAudioTracks().length > 0,
  };
}

async function requestMicrophoneStream(): Promise<MediaStream> {
  const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

  if (!getUserMedia) {
    throw new Error("Microphone access is not supported in this browser.");
  }

  return getUserMedia({
    audio: {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true,
    },
    video: false,
  });
}

async function requestCameraStream(): Promise<MediaStream> {
  const getUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);

  if (!getUserMedia) {
    throw new Error("Camera access is not supported in this browser.");
  }

  return getUserMedia({
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      frameRate: { ideal: 30 },
    },
    audio: false,
  });
}

function Avatar({
  participant,
  size = "md",
}: {
  participant: Participant;
  size?: "sm" | "md" | "lg";
}) {
  const sizeClass =
    size === "sm"
      ? "h-9 w-9 text-xs"
      : size === "lg"
        ? "h-12 w-12 text-base"
        : "h-10 w-10 text-sm";

  return (
    <div
      className={`${sizeClass} flex shrink-0 items-center justify-center rounded-full font-bold text-white`}
      style={{ backgroundColor: participant.color }}
    >
      {getInitials(participant.displayName)}
    </div>
  );
}

function ControlButton({
  onClick,
  active,
  icon,
  label,
  danger,
  accent,
  disabled,
}: {
  onClick: () => void;
  active: boolean;
  icon: React.ReactNode;
  label: string;
  danger?: boolean;
  accent?: boolean;
  disabled?: boolean;
}) {
  const style = (() => {
    if (accent && active) {
      return "border-[#57f287]/40 bg-[#57f287]/15 text-[#57f287] hover:bg-[#57f287]/25";
    }

    if (accent) {
      return "border-[#5865f2]/40 bg-[#5865f2]/15 text-[#5865f2] hover:bg-[#5865f2]/25";
    }

    if (danger) {
      return "border-[#ed4245]/30 bg-[#ed4245]/10 text-[#ed4245] hover:bg-[#ed4245]/20";
    }

    if (active) {
      return "border-[#4b4d55] bg-[#3f4147] text-[#dbdee1] hover:bg-[#46484f]";
    }

    return "border-[#3f4147] bg-[#1e1f22] text-[#949ba4] hover:bg-[#3f4147] hover:text-[#dbdee1]";
  })();

  return (
    <button
      className={`flex min-w-[86px] flex-col items-center gap-1 rounded-xl border px-4 py-2 transition ${style} disabled:cursor-not-allowed disabled:opacity-40`}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      {icon}
      <span className="text-[0.64rem] font-semibold">{label}</span>
    </button>
  );
}

export function RoomPageClient({
  roomCode,
  initialName,
  initialRole,
  iceServers,
}: RoomPageClientProps) {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [selfSocketId, setSelfSocketId] = useState<string | null>(null);
  const [roomState, setRoomState] = useState<RoomState | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activePanel, setActivePanel] = useState<PanelTab>("participants");
  const [chatInput, setChatInput] = useState("");
  const [codeCopied, setCodeCopied] = useState(false);
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [peerStatuses, setPeerStatuses] = useState<PeerStatusMap>({});
  const [selectedPreset, setSelectedPreset] =
    useState<QualityPresetKey>("1080p30");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [noticeMessage, setNoticeMessage] = useState<string | null>(null);
  const [isSocketConnected, setIsSocketConnected] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [shareBusyState, setShareBusyState] =
    useState<"starting" | "stopping" | null>(null);
  const [isMuted, setIsMuted] = useState(true);
  const [isCameraOn, setIsCameraOn] = useState(false);
  const [isMicrophoneBusy, setIsMicrophoneBusy] = useState(false);
  const [isCameraBusy, setIsCameraBusy] = useState(false);
  const [audioStatus, setAudioStatus] = useState<
    "idle" | "captured" | "unsupported"
  >("idle");
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [cameraStream, setCameraStream] = useState<MediaStream | null>(null);

  const displayName = useMemo(
    () => initialName.trim() || buildDefaultName(initialRole),
    [initialName, initialRole],
  );
  const isHost = initialRole === "host";
  const participants = roomState?.participants ?? [];
  const hostParticipant = getHostParticipant(participants);
  const activeVideoStream = isHost ? localStream : remoteStream;
  const hasActiveVideo = Boolean(activeVideoStream);

  const localVideoRef = useRef<HTMLVideoElement | null>(null);
  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraPreviewRef = useRef<HTMLVideoElement | null>(null);
  const socketRef = useRef<SocketClient | null>(null);
  const peerManagerRef = useRef<PeerManager | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const microphoneStreamRef = useRef<MediaStream | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const detachEndedListenerRef = useRef<(() => void) | null>(null);
  const roomStateRef = useRef<RoomState | null>(null);
  const selectedPresetRef = useRef<QualityPresetKey>("1080p30");

  useEffect(() => {
    roomStateRef.current = roomState;
  }, [roomState]);

  useEffect(() => {
    selectedPresetRef.current = selectedPreset;
  }, [selectedPreset]);

  const syncVideoElement = useCallback(
    (element: HTMLVideoElement | null, stream: MediaStream | null, muted = false) => {
      if (!element) {
        return;
      }

      if (element.srcObject !== stream) {
        element.srcObject = stream;
      }

      element.muted = muted;
    },
    [],
  );

  useEffect(() => {
    syncVideoElement(localVideoRef.current, localStream, true);
  }, [localStream, syncVideoElement]);

  useEffect(() => {
    syncVideoElement(remoteVideoRef.current, remoteStream, false);
  }, [remoteStream, syncVideoElement]);

  useEffect(() => {
    syncVideoElement(cameraPreviewRef.current, cameraStream, true);
  }, [cameraStream, syncVideoElement]);

  const emitOwnMediaState = useCallback(
    (nextMuted: boolean, nextCameraOn: boolean) => {
      socketRef.current?.emit("participant:media-state", {
        roomCode,
        isMuted: nextMuted,
        isCameraOn: nextCameraOn,
      });
    },
    [roomCode],
  );

  const updatePeerStatus = useCallback(
    (peerId: string, status: RTCPeerConnectionState | "idle" | "live") => {
      setPeerStatuses((current) => ({
        ...current,
        [peerId]: status,
      }));
    },
    [],
  );

  const clearPeerStatus = useCallback((peerId: string) => {
    setPeerStatuses((current) => {
      const next = { ...current };
      delete next[peerId];
      return next;
    });
  }, []);

  const stopCamera = useCallback(() => {
    stopMediaStream(cameraStreamRef.current);
    cameraStreamRef.current = null;
    setCameraStream(null);
    setIsCameraOn(false);
  }, []);

  const stopMicrophone = useCallback(() => {
    stopMediaStream(microphoneStreamRef.current);
    microphoneStreamRef.current = null;
    setIsMuted(true);
  }, []);

  const tearDownLocalShare = useCallback(
    (options?: { announce?: boolean }) => {
      const socket = socketRef.current;
      detachEndedListenerRef.current?.();
      detachEndedListenerRef.current = null;
      peerManagerRef.current?.closeAll();
      stopMediaStream(localStreamRef.current);
      localStreamRef.current = null;
      setLocalStream(null);
      setIsSharing(false);
      setAudioStatus("idle");
      setPeerStatuses({});

      if (options?.announce !== false && socket && isHost && socket.connected) {
        socket.emit("share:stop", { roomCode });
      }
    },
    [isHost, roomCode],
  );

  const createPeerHandlers = useCallback(
    (peerId: string) => ({
      onIceCandidate: (candidate: RTCIceCandidateInit) => {
        socketRef.current?.emit("webrtc:ice", {
          roomCode,
          targetPeerId: peerId,
          candidate,
        });
      },
      onTrack: (event: RTCTrackEvent) => {
        if (!isHost) {
          const [stream] = event.streams;
          setRemoteStream(stream ?? null);
        }
      },
      onConnectionStateChange: (state: RTCPeerConnectionState) => {
        updatePeerStatus(peerId, state);

        if (state === "failed" || state === "closed") {
          peerManagerRef.current?.close(peerId);
          clearPeerStatus(peerId);

          if (!isHost) {
            setRemoteStream(null);
          }
        }
      },
    }),
    [clearPeerStatus, isHost, roomCode, updatePeerStatus],
  );

  const createHostOffer = useCallback(
    async (peerId: string) => {
      const stream = localStreamRef.current;
      const socket = socketRef.current;

      if (!stream || !socket || !peerManagerRef.current) {
        return;
      }

      const connection = peerManagerRef.current.create(
        peerId,
        createPeerHandlers(peerId),
      );

      await attachLocalStream(
        connection,
        stream,
        QUALITY_BITRATES[selectedPresetRef.current],
      );

      const offer = await connection.createOffer();
      await connection.setLocalDescription(offer);
      updatePeerStatus(peerId, "connecting");

      socket.emit("webrtc:offer", {
        roomCode,
        targetPeerId: peerId,
        sdp: offer,
      });
    },
    [createPeerHandlers, roomCode, updatePeerStatus],
  );

  const handleInboundOffer = useCallback(
    async (payload: InboundOfferPayload) => {
      if (!peerManagerRef.current) {
        return;
      }

      const connection = peerManagerRef.current.create(
        payload.fromPeerId,
        createPeerHandlers(payload.fromPeerId),
      );

      await connection.setRemoteDescription(payload.sdp);
      const answer = await connection.createAnswer();
      await connection.setLocalDescription(answer);
      updatePeerStatus(payload.fromPeerId, "connecting");

      socketRef.current?.emit("webrtc:answer", {
        roomCode,
        targetPeerId: payload.fromPeerId,
        sdp: answer,
      });
    },
    [createPeerHandlers, roomCode, updatePeerStatus],
  );

  const handleInboundAnswer = useCallback(async (payload: InboundAnswerPayload) => {
    const connection = peerManagerRef.current?.get(payload.fromPeerId);

    if (!connection) {
      return;
    }

    await connection.setRemoteDescription(payload.sdp);
  }, []);

  const handleInboundIce = useCallback(async (payload: InboundIcePayload) => {
    const connection = peerManagerRef.current?.get(payload.fromPeerId);

    if (!connection) {
      return;
    }

    try {
      await connection.addIceCandidate(payload.candidate);
    } catch (error) {
      console.warn("Failed to apply ICE candidate.", error);
    }
  }, []);

  const startSharing = useCallback(
    async (preset: QualityPresetKey) => {
      if (!isHost) {
        return;
      }

      setErrorMessage(null);
      setNoticeMessage(null);
      setShareBusyState("starting");

      try {
        tearDownLocalShare({ announce: false });

        const { stream, hasAudioTrack } = await captureDisplayStream(preset);
        const [videoTrack] = stream.getVideoTracks();

        if (videoTrack) {
          videoTrack.contentHint = "detail";

          const handleEnded = () => {
            tearDownLocalShare();
            setNoticeMessage("Screen sharing stopped from the browser picker.");
          };

          videoTrack.addEventListener("ended", handleEnded, { once: true });
          detachEndedListenerRef.current = () => {
            videoTrack.removeEventListener("ended", handleEnded);
          };
        }

        localStreamRef.current = stream;
        setLocalStream(stream);
        setIsSharing(true);
        setAudioStatus(hasAudioTrack ? "captured" : "unsupported");
        setNoticeMessage(
          hasAudioTrack
            ? "Share started. Browser audio was captured when supported."
            : "Share started without browser audio. Chromium usually offers the best support.",
        );

        socketRef.current?.emit("share:start", {
          roomCode,
          preset,
        });
      } catch (error) {
        tearDownLocalShare({ announce: false });
        setErrorMessage(
          error instanceof Error
            ? error.message
            : "Failed to start screen sharing.",
        );
      } finally {
        setShareBusyState(null);
      }
    },
    [isHost, roomCode, tearDownLocalShare],
  );

  const stopSharing = useCallback(() => {
    setShareBusyState("stopping");
    tearDownLocalShare();
    setNoticeMessage("Screen sharing stopped.");
    setShareBusyState(null);
  }, [tearDownLocalShare]);

  const handlePresetChange = useCallback(
    async (nextPreset: QualityPresetKey) => {
      setSelectedPreset(nextPreset);

      if (isHost && localStreamRef.current) {
        await startSharing(nextPreset);
      }
    },
    [isHost, startSharing],
  );

  const handleToggleMute = useCallback(async () => {
    setErrorMessage(null);
    setIsMicrophoneBusy(true);

    try {
      if (isMuted) {
        const nextMicStream = await requestMicrophoneStream();
        microphoneStreamRef.current = nextMicStream;
        setIsMuted(false);
        emitOwnMediaState(false, isCameraOn);
        setNoticeMessage("Microphone ready. Multi-peer voice routing can be layered next.");
      } else {
        stopMicrophone();
        emitOwnMediaState(true, isCameraOn);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to access your microphone.",
      );
    } finally {
      setIsMicrophoneBusy(false);
    }
  }, [emitOwnMediaState, isCameraOn, isMuted, stopMicrophone]);

  const handleToggleCamera = useCallback(async () => {
    setErrorMessage(null);
    setIsCameraBusy(true);

    try {
      if (!isCameraOn) {
        const nextCameraStream = await requestCameraStream();
        cameraStreamRef.current = nextCameraStream;
        setCameraStream(nextCameraStream);
        setIsCameraOn(true);
        emitOwnMediaState(isMuted, true);
        setNoticeMessage("Camera preview enabled.");
      } else {
        stopCamera();
        emitOwnMediaState(isMuted, false);
      }
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to access your camera.",
      );
    } finally {
      setIsCameraBusy(false);
    }
  }, [emitOwnMediaState, isCameraOn, isMuted, stopCamera]);

  const handleCopyCode = useCallback(async () => {
    try {
      setErrorMessage(null);
      await copyText(roomCode);
      setCodeCopied(true);
      window.setTimeout(() => {
        setCodeCopied(false);
      }, 2000);
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to copy the room code.",
      );
    }
  }, [roomCode]);

  const handleSendMessage = useCallback(() => {
    const text = chatInput.trim();
    if (!text) {
      return;
    }

    socketRef.current?.emit("chat:send", {
      roomCode,
      text,
    });
    setChatInput("");
  }, [chatInput, roomCode]);

  const handleFullscreen = useCallback(async () => {
    try {
      setErrorMessage(null);
      await openVideoFullscreen(isHost ? localVideoRef.current : remoteVideoRef.current);
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Failed to enter fullscreen mode.",
      );
    }
  }, [isHost]);

  const handleLeave = useCallback(() => {
    setShowLeaveConfirm(false);
    startTransition(() => {
      router.push("/");
    });
  }, [router, startTransition]);

  useEffect(() => {
    if (!initialRole) {
      setErrorMessage("Missing room role in the URL.");
      return;
    }

    peerManagerRef.current = new PeerManager(iceServers);

    const socket = io(getSignalingUrl(), {
      transports: ["websocket", "polling"],
    });

    socketRef.current = socket;

    socket.on("connect", () => {
      setSelfSocketId(socket.id ?? null);
      setIsSocketConnected(true);
      setErrorMessage(null);

      if (initialRole === "host") {
        socket.emit("room:create", {
          roomCode,
          displayName,
        });
      } else {
        socket.emit("room:join", {
          roomCode,
          displayName,
        });
      }
    });

    socket.on("disconnect", () => {
      setIsSocketConnected(false);
    });

    socket.on("room:state", (nextRoomState) => {
      setRoomState(nextRoomState);

      if (!nextRoomState.activeShare && !isHost) {
        peerManagerRef.current?.closeAll();
        setRemoteStream(null);
      }
    });

    socket.on("chat:message", (payload) => {
      setMessages((current) => [...current, payload]);
    });

    socket.on("peer:ready", async ({ peerId }) => {
      if (!isHost || !localStreamRef.current) {
        return;
      }

      await createHostOffer(peerId);
    });

    socket.on("webrtc:offer", async (payload) => {
      await handleInboundOffer(payload);
    });

    socket.on("webrtc:answer", async (payload) => {
      await handleInboundAnswer(payload);
    });

    socket.on("webrtc:ice", async (payload) => {
      await handleInboundIce(payload);
    });

    socket.on("participant:left", ({ participantId }) => {
      peerManagerRef.current?.close(participantId);
      clearPeerStatus(participantId);

      if (
        !isHost &&
        participantId === getHostParticipant(roomStateRef.current?.participants ?? [])?.id
      ) {
        setRemoteStream(null);
      }
    });

    socket.on("room:closed", ({ reason }) => {
      tearDownLocalShare({ announce: false });
      peerManagerRef.current?.closeAll();
      setRemoteStream(null);
      setRoomState(null);
      setNoticeMessage(null);
      setErrorMessage(reason);
    });

    socket.on("error", ({ message }: AppErrorPayload) => {
      setErrorMessage(message);
    });

    return () => {
      tearDownLocalShare({ announce: false });
      stopMicrophone();
      stopCamera();
      peerManagerRef.current?.closeAll();
      peerManagerRef.current = null;
      socket.removeAllListeners();
      socket.disconnect();
      socketRef.current = null;
      setRemoteStream(null);
    };
  }, [
    clearPeerStatus,
    createHostOffer,
    displayName,
    handleInboundAnswer,
    handleInboundIce,
    handleInboundOffer,
    iceServers,
    initialRole,
    isHost,
    roomCode,
    stopCamera,
    stopMicrophone,
    tearDownLocalShare,
  ]);

  const sharingOwnerName = isHost
    ? displayName
    : hostParticipant?.displayName ?? "Host";
  const mainTitle = hasActiveVideo
    ? isHost
      ? "Screen sharing active"
      : `${sharingOwnerName} is sharing`
    : "No screen being shared";
  const mainDescription = hasActiveVideo
    ? isHost
      ? "Your shared screen is live in this room."
      : "Incoming stream connected from the room host."
    : isHost
      ? 'Click "Share Screen" below to start broadcasting.'
      : "Waiting for the host to start sharing their screen.";

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#1e1f22] text-white">
      <header className="flex h-14 shrink-0 items-center gap-4 border-b border-[#3f4147] bg-[#2b2d31] px-4">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#5865f2]">
            <Tv2 size={14} className="text-white" />
          </div>
          <span className="text-base font-semibold text-white">Streamzon</span>
        </div>

        <div className="h-5 w-px bg-[#3f4147]" />

        <div className="flex flex-1 items-center gap-2 overflow-hidden">
          <div className="flex items-center gap-1.5 rounded-lg border border-[#3f4147] bg-[#1e1f22] px-3 py-1.5">
            <span className="text-xs text-[#949ba4]">Room</span>
            <span className="text-xs font-bold tracking-[0.18em] text-white">
              {roomCode}
            </span>
          </div>

          <button
            className="flex items-center gap-1.5 rounded-lg border border-[#3f4147] bg-[#1e1f22] px-3 py-1.5 text-xs text-[#949ba4] transition hover:bg-[#3f4147] hover:text-[#dbdee1]"
            onClick={() => void handleCopyCode()}
            type="button"
          >
            {codeCopied ? (
              <>
                <Check size={12} className="text-[#57f287]" />
                <span className="font-medium text-[#57f287]">Copied!</span>
              </>
            ) : (
              <>
                <Copy size={12} />
                <span>Copy</span>
              </>
            )}
          </button>

          {isHost ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#fee75c]/20 bg-[#fee75c]/10 px-3 py-1.5">
              <Crown size={12} className="text-[#fee75c]" />
              <span className="text-xs font-semibold text-[#fee75c]">Host</span>
            </div>
          ) : null}

          {roomState?.activeShare ? (
            <div className="flex items-center gap-1.5 rounded-lg border border-[#57f287]/20 bg-[#57f287]/10 px-3 py-1.5">
              <div className="h-2 w-2 animate-pulse rounded-full bg-[#57f287]" />
              <span className="text-xs font-semibold text-[#57f287]">Sharing</span>
            </div>
          ) : null}

          <div className="hidden items-center gap-1.5 rounded-lg border border-[#3f4147] bg-[#1e1f22] px-3 py-1.5 text-xs text-[#949ba4] lg:flex">
            <Signal size={12} className={isSocketConnected ? "text-[#57f287]" : "text-[#ed4245]"} />
            <span>{isSocketConnected ? "Connected" : "Reconnecting"}</span>
          </div>

          <div className="hidden items-center gap-1.5 rounded-lg border border-[#3f4147] bg-[#1e1f22] px-3 py-1.5 text-xs text-[#949ba4] lg:flex">
            <Mic size={12} className={audioStatus === "captured" ? "text-[#57f287]" : "text-[#949ba4]"} />
            <span>{audioStatus === "captured" ? "Share audio on" : "Share audio idle"}</span>
          </div>

          {isHost ? (
            <div className="hidden items-center gap-2 rounded-lg border border-[#3f4147] bg-[#1e1f22] px-3 py-1.5 lg:flex">
              <span className="text-xs text-[#949ba4]">Quality</span>
              <select
                className="bg-transparent text-xs text-white outline-none"
                disabled={shareBusyState !== null}
                onChange={(event) =>
                  void handlePresetChange(event.target.value as QualityPresetKey)
                }
                value={selectedPreset}
              >
                {QUALITY_OPTIONS.map((preset) => (
                  <option
                    key={preset.key}
                    className="bg-[#1e1f22] text-white"
                    value={preset.key}
                  >
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5 text-[#949ba4]">
            <Users size={14} />
            <span className="text-sm">{participants.length}</span>
          </div>

          <button
            className="flex items-center gap-2 rounded-lg border border-[#ed4245]/30 bg-[#ed4245]/10 px-4 py-2 text-sm font-semibold text-[#ed4245] transition hover:bg-[#ed4245]/20"
            onClick={() => setShowLeaveConfirm(true)}
            type="button"
          >
            <Phone size={13} className="rotate-[135deg]" />
            Leave
          </button>
        </div>
      </header>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex flex-1 flex-col overflow-hidden">
          <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-[#111214] p-4">
            {errorMessage ? (
              <div className="absolute left-4 right-4 top-4 z-20 rounded-xl border border-[#ed4245]/30 bg-[#ed4245]/10 px-4 py-3 text-sm text-[#ffb3b8]">
                {errorMessage}
              </div>
            ) : null}

            {noticeMessage ? (
              <div className="absolute left-4 right-4 top-4 z-10 rounded-xl border border-[#5865f2]/25 bg-[#5865f2]/10 px-4 py-3 text-sm text-[#c4cbff]">
                {noticeMessage}
              </div>
            ) : null}

            {hasActiveVideo ? (
              <div className="relative flex h-full w-full max-w-6xl items-center justify-center overflow-hidden rounded-2xl border border-[#3f4147] bg-black shadow-2xl">
                {isHost ? (
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-contain"
                  />
                )}

                <div className="absolute left-3 top-3 flex items-center gap-2 rounded-lg border border-[#3f4147]/70 bg-[#1e1f22]/85 px-3 py-1.5 backdrop-blur-sm">
                  <div className="h-2 w-2 animate-pulse rounded-full bg-[#57f287]" />
                  <span className="text-xs font-semibold text-white">
                    {sharingOwnerName}
                  </span>
                  <span className="text-xs text-[#949ba4]">
                    {isHost ? "is sharing" : "live stream"}
                  </span>
                </div>

                <button
                  className="absolute right-3 top-3 flex items-center gap-2 rounded-lg border border-[#3f4147]/70 bg-[#1e1f22]/85 px-3 py-1.5 text-xs text-[#dbdee1] backdrop-blur-sm transition hover:bg-[#313338]"
                  disabled={!hasActiveVideo}
                  onClick={() => void handleFullscreen()}
                  type="button"
                >
                  <Maximize2 size={13} />
                  Fullscreen
                </button>
              </div>
            ) : (
              <div className="max-w-sm space-y-5 text-center">
                <div className="mx-auto flex h-24 w-24 items-center justify-center rounded-[1.8rem] border border-[#3f4147] bg-[#2b2d31]">
                  <Monitor size={34} className="text-[#3f4147]" />
                </div>
                <div className="space-y-2">
                  <p className="text-2xl font-semibold text-[#f2f3f5]">{mainTitle}</p>
                  <p className="text-sm leading-7 text-[#949ba4]">{mainDescription}</p>
                </div>
                {isHost ? (
                  <button
                    className="mx-auto flex items-center gap-2 rounded-2xl bg-[#5865f2] px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-[#5865f2]/20 transition hover:bg-[#4752c4] disabled:cursor-not-allowed disabled:opacity-60"
                    disabled={shareBusyState !== null}
                    onClick={() => void startSharing(selectedPreset)}
                    type="button"
                  >
                    <Monitor size={15} />
                    {shareBusyState === "starting" ? "Starting..." : "Start Sharing"}
                  </button>
                ) : null}
              </div>
            )}

            {cameraStream ? (
              <div className="absolute bottom-4 right-4 overflow-hidden rounded-2xl border border-[#3f4147] bg-[#2b2d31] shadow-xl">
                <div className="relative h-24 w-36 bg-black">
                  <video
                    ref={cameraPreviewRef}
                    autoPlay
                    playsInline
                    className="h-full w-full object-cover"
                  />
                  <div className="absolute bottom-2 left-2 rounded-md bg-black/60 px-2 py-1 text-[0.65rem] font-semibold text-white">
                    You
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          <div className="flex h-[90px] shrink-0 items-center justify-center gap-3 border-t border-[#3f4147] bg-[#2b2d31] px-6">
            <ControlButton
              active={!isMuted}
              danger={isMuted}
              disabled={isMicrophoneBusy}
              icon={isMuted ? <MicOff size={18} /> : <Mic size={18} />}
              label={isMuted ? "Unmute" : "Mute"}
              onClick={() => void handleToggleMute()}
            />

            <ControlButton
              active={isCameraOn}
              danger={!isCameraOn}
              disabled={isCameraBusy}
              icon={isCameraOn ? <Video size={18} /> : <VideoOff size={18} />}
              label={isCameraOn ? "Stop Cam" : "Start Cam"}
              onClick={() => void handleToggleCamera()}
            />

            {isHost ? (
              <ControlButton
                active={isSharing}
                accent
                disabled={shareBusyState !== null}
                icon={isSharing ? <MonitorOff size={18} /> : <Monitor size={18} />}
                label={isSharing ? "Stop Share" : "Share Screen"}
                onClick={() => {
                  if (isSharing) {
                    stopSharing();
                    return;
                  }

                  void startSharing(selectedPreset);
                }}
              />
            ) : null}

            <div className="mx-1 h-8 w-px bg-[#3f4147]" />

            <ControlButton
              active={activePanel === "chat"}
              icon={<MessageSquare size={18} />}
              label="Chat"
              onClick={() =>
                setActivePanel((current) =>
                  current === "chat" ? "participants" : "chat",
                )
              }
            />

            <ControlButton
              active={activePanel === "participants"}
              icon={<Users size={18} />}
              label="People"
              onClick={() =>
                setActivePanel((current) =>
                  current === "participants" ? "chat" : "participants",
                )
              }
            />

            <div className="mx-1 h-8 w-px bg-[#3f4147]" />

            <button
              className="flex min-w-[86px] flex-col items-center gap-1 rounded-xl border border-[#ed4245]/30 bg-[#ed4245]/10 px-4 py-2 text-[#ed4245] transition hover:bg-[#ed4245]/20"
              onClick={() => setShowLeaveConfirm(true)}
              type="button"
            >
              <Phone size={18} className="rotate-[135deg]" />
              <span className="text-[0.64rem] font-semibold">Leave</span>
            </button>
          </div>
        </div>

        <aside className="flex w-[320px] shrink-0 flex-col border-l border-[#3f4147] bg-[#2b2d31]">
          <div className="flex shrink-0 border-b border-[#3f4147]">
            {(["participants", "chat"] as const).map((tab) => {
              const isActive = activePanel === tab;
              return (
                <button
                  key={tab}
                  className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-semibold transition ${
                    isActive
                      ? "border-b-2 border-[#5865f2] text-white"
                      : "text-[#949ba4] hover:text-[#dbdee1]"
                  }`}
                  onClick={() => setActivePanel(tab)}
                  type="button"
                >
                  {tab === "participants" ? (
                    <>
                      <Users size={14} />
                      People ({participants.length})
                    </>
                  ) : (
                    <>
                      <MessageSquare size={14} />
                      Chat
                    </>
                  )}
                </button>
              );
            })}
          </div>

          {activePanel === "participants" ? (
            <div className="flex-1 overflow-y-auto p-3">
              <div className="space-y-2">
                {participants.length > 0 ? (
                  participants.map((participant) => {
                    const isYou = participant.id === selfSocketId;
                    const connectionState =
                      peerStatuses[participant.id] ??
                      (participant.id === hostParticipant?.id && roomState?.activeShare
                        ? "live"
                        : "idle");

                    return (
                      <div
                        key={participant.id}
                        className="flex items-center gap-3 rounded-xl px-3 py-3 transition hover:bg-[#3f4147]/40"
                      >
                        <div className="relative">
                          <Avatar participant={participant} size="sm" />
                          <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-[#2b2d31] bg-[#57f287]" />
                        </div>

                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-[#dbdee1]">
                            {participant.displayName}
                            {isYou ? (
                              <span className="ml-1 text-xs text-[#949ba4]">(you)</span>
                            ) : null}
                          </p>
                          <div className="mt-1 flex items-center gap-2 text-[0.68rem]">
                            {participant.role === "host" ? (
                              <span className="font-semibold uppercase text-[#fee75c]">
                                Host
                              </span>
                            ) : (
                              <span className="text-[#949ba4]">viewer</span>
                            )}
                            <span className="text-[#6f7683]">•</span>
                            <span className="text-[#949ba4]">{connectionState}</span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {participant.isCameraOn ? (
                            <Video size={13} className="text-[#57f287]" />
                          ) : (
                            <VideoOff size={13} className="text-[#949ba4]" />
                          )}
                          {participant.isMuted ? (
                            <MicOff size={13} className="text-[#ed4245]" />
                          ) : (
                            <Mic size={13} className="text-[#57f287]" />
                          )}
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="rounded-xl border border-dashed border-[#3f4147] px-4 py-5 text-sm text-[#949ba4]">
                    Waiting for room data from the signaling server.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex-1 overflow-y-auto p-4">
                <div className="space-y-4">
                  {messages.length > 0 ? (
                    messages.map((message) => (
                      <div key={message.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span
                            className="text-xs font-semibold"
                            style={{ color: message.authorColor }}
                          >
                            {message.authorName}
                          </span>
                          <span className="text-[0.68rem] text-[#949ba4]">
                            {formatMessageTime(message.createdAt)}
                          </span>
                        </div>
                        <p
                          className={`text-sm leading-6 ${
                            message.isSystem ? "text-[#b5bac1]" : "text-[#dbdee1]"
                          }`}
                        >
                          {message.text}
                        </p>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-xl border border-dashed border-[#3f4147] px-4 py-5 text-sm text-[#949ba4]">
                      Room messages will appear here.
                    </div>
                  )}
                </div>
              </div>

              <div className="border-t border-[#3f4147] p-3">
                <div className="flex items-center gap-2 rounded-xl border border-[#3f4147] bg-[#1e1f22] px-3 py-2">
                  <input
                    className="flex-1 bg-transparent text-sm text-[#dbdee1] outline-none placeholder:text-[#949ba4]"
                    onChange={(event) => setChatInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleSendMessage();
                      }
                    }}
                    placeholder="Message the room..."
                    value={chatInput}
                  />
                  <button
                    className="text-[#5865f2] transition hover:text-[#8891f2] disabled:cursor-not-allowed disabled:opacity-30"
                    disabled={!chatInput.trim()}
                    onClick={handleSendMessage}
                    type="button"
                  >
                    <Send size={15} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </aside>
      </div>

      {showLeaveConfirm ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-sm rounded-2xl border border-[#3f4147] bg-[#2b2d31] p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 className="text-lg font-bold text-white">Leave room?</h3>
                <p className="mt-2 text-sm leading-6 text-[#949ba4]">
                  {isHost
                    ? "Leaving will end the session for everyone in this room."
                    : "You can rejoin later with the same room code."}
                </p>
              </div>
              <button
                className="text-[#949ba4] transition hover:text-[#dbdee1]"
                onClick={() => setShowLeaveConfirm(false)}
                type="button"
              >
                <X size={18} />
              </button>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                className="flex-1 rounded-xl border border-[#3f4147] bg-[#1e1f22] px-4 py-3 text-sm font-semibold text-[#dbdee1] transition hover:bg-[#3f4147]"
                onClick={() => setShowLeaveConfirm(false)}
                type="button"
              >
                Stay
              </button>
              <button
                className="flex-1 rounded-xl bg-[#ed4245] px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-[#ed4245]/20 transition hover:bg-[#c03537]"
                disabled={isNavigating}
                onClick={handleLeave}
                type="button"
              >
                Leave
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {!roomState && !errorMessage ? (
        <div className="pointer-events-none fixed bottom-4 left-4 rounded-xl border border-[#3f4147] bg-[#2b2d31]/90 px-4 py-3 text-sm text-[#949ba4] backdrop-blur">
          Connecting to room {roomCode}...
        </div>
      ) : null}
    </div>
  );
}
