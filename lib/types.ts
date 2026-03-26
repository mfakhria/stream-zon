export type QualityPresetKey = "720p30" | "720p60" | "1080p30" | "1080p60";
export type RoomRole = "host" | "viewer";

export interface QualityPresetConfig {
  key: QualityPresetKey;
  label: string;
  width: number;
  height: number;
  frameRate: number;
  idealBandwidthMbps: string;
}

export interface Participant {
  id: string;
  displayName: string;
  role: RoomRole;
  joinedAt: number;
  color: string;
  isMuted: boolean;
  isCameraOn: boolean;
}

export interface RoomState {
  roomCode: string;
  activeShare: boolean;
  currentPreset: QualityPresetKey | null;
  maxParticipants: number;
  participants: Participant[];
}

export interface CreateRoomPayload {
  roomCode?: string;
  displayName: string;
}

export interface JoinRoomPayload {
  roomCode: string;
  displayName: string;
}

export interface ShareStartPayload {
  roomCode: string;
  preset: QualityPresetKey;
}

export interface ShareStopPayload {
  roomCode: string;
}

export interface PeerReadyPayload {
  peerId: string;
}

export interface ParticipantLeftPayload {
  participantId: string;
}

export interface UpdateMediaStatePayload {
  roomCode: string;
  isMuted: boolean;
  isCameraOn: boolean;
}

export interface ChatMessage {
  id: string;
  roomCode: string;
  authorId: string | null;
  authorName: string;
  authorColor: string;
  text: string;
  createdAt: number;
  isSystem: boolean;
}

export interface ChatSendPayload {
  roomCode: string;
  text: string;
}

export interface RoomClosedPayload {
  roomCode: string;
  reason: string;
}

export interface AppErrorPayload {
  code:
    | "ROOM_EXISTS"
    | "ROOM_NOT_FOUND"
    | "ROOM_FULL"
    | "HOST_REQUIRED"
    | "UNAUTHORIZED"
    | "INVALID_PAYLOAD"
    | "INTERNAL_ERROR";
  message: string;
}

export interface SignalOfferPayload {
  roomCode: string;
  targetPeerId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalAnswerPayload {
  roomCode: string;
  targetPeerId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface SignalIcePayload {
  roomCode: string;
  targetPeerId: string;
  candidate: RTCIceCandidateInit;
}

export interface InboundOfferPayload {
  fromPeerId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface InboundAnswerPayload {
  fromPeerId: string;
  sdp: RTCSessionDescriptionInit;
}

export interface InboundIcePayload {
  fromPeerId: string;
  candidate: RTCIceCandidateInit;
}

export interface ServerToClientEvents {
  "room:state": (payload: RoomState) => void;
  "peer:ready": (payload: PeerReadyPayload) => void;
  "webrtc:offer": (payload: InboundOfferPayload) => void;
  "webrtc:answer": (payload: InboundAnswerPayload) => void;
  "webrtc:ice": (payload: InboundIcePayload) => void;
  "chat:message": (payload: ChatMessage) => void;
  "participant:left": (payload: ParticipantLeftPayload) => void;
  "room:closed": (payload: RoomClosedPayload) => void;
  error: (payload: AppErrorPayload) => void;
}

export interface ClientToServerEvents {
  "room:create": (payload: CreateRoomPayload) => void;
  "room:join": (payload: JoinRoomPayload) => void;
  "share:start": (payload: ShareStartPayload) => void;
  "share:stop": (payload: ShareStopPayload) => void;
  "participant:media-state": (payload: UpdateMediaStatePayload) => void;
  "chat:send": (payload: ChatSendPayload) => void;
  "webrtc:offer": (payload: SignalOfferPayload) => void;
  "webrtc:answer": (payload: SignalAnswerPayload) => void;
  "webrtc:ice": (payload: SignalIcePayload) => void;
}
