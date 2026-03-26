export interface PeerConnectionHandlers {
  onIceCandidate: (candidate: RTCIceCandidateInit, peerId: string) => void;
  onTrack?: (event: RTCTrackEvent, peerId: string) => void;
  onConnectionStateChange?: (
    state: RTCPeerConnectionState,
    peerId: string,
    connection: RTCPeerConnection,
  ) => void;
}

export class PeerManager {
  private connections = new Map<string, RTCPeerConnection>();

  constructor(private readonly iceServers: RTCIceServer[]) {}

  create(peerId: string, handlers: PeerConnectionHandlers): RTCPeerConnection {
    this.close(peerId);

    const connection = new RTCPeerConnection({
      iceServers: this.iceServers,
    });

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        handlers.onIceCandidate(event.candidate.toJSON(), peerId);
      }
    };

    connection.ontrack = (event) => {
      handlers.onTrack?.(event, peerId);
    };

    connection.onconnectionstatechange = () => {
      handlers.onConnectionStateChange?.(
        connection.connectionState,
        peerId,
        connection,
      );
    };

    this.connections.set(peerId, connection);
    return connection;
  }

  get(peerId: string): RTCPeerConnection | undefined {
    return this.connections.get(peerId);
  }

  close(peerId: string): void {
    const connection = this.connections.get(peerId);
    if (!connection) {
      return;
    }

    connection.onicecandidate = null;
    connection.ontrack = null;
    connection.onconnectionstatechange = null;
    connection.close();
    this.connections.delete(peerId);
  }

  closeAll(): void {
    for (const peerId of this.connections.keys()) {
      this.close(peerId);
    }
  }
}

export async function attachLocalStream(
  connection: RTCPeerConnection,
  stream: MediaStream,
  maxBitrate: number,
): Promise<void> {
  const attachedTracks = new Set(
    connection
      .getSenders()
      .map((sender) => sender.track?.id)
      .filter((trackId): trackId is string => Boolean(trackId)),
  );

  for (const track of stream.getTracks()) {
    if (attachedTracks.has(track.id)) {
      continue;
    }

    const sender = connection.addTrack(track, stream);

    if (track.kind === "video") {
      await applySenderMaxBitrate(sender, maxBitrate);
    }
  }
}

export async function applySenderMaxBitrate(
  sender: RTCRtpSender,
  maxBitrate: number,
): Promise<void> {
  try {
    const parameters = sender.getParameters();
    const encodings = parameters.encodings ?? [{}];

    encodings[0] = {
      ...encodings[0],
      maxBitrate,
    };

    parameters.encodings = encodings;
    await sender.setParameters(parameters);
  } catch (error) {
    console.warn("Unable to apply RTCRtpSender maxBitrate.", error);
  }
}

export function stopMediaStream(stream: MediaStream | null): void {
  if (!stream) {
    return;
  }

  for (const track of stream.getTracks()) {
    track.stop();
  }
}
