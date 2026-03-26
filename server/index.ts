import "dotenv/config";

import { createServer } from "node:http";

import { Server } from "socket.io";

import { DEFAULT_MAX_PARTICIPANTS } from "@/lib/constants";
import { getMaxParticipants } from "@/lib/env";
import { generateRoomCode, normalizeRoomCode } from "@/lib/room-code";
import type {
  AppErrorPayload,
  ChatMessage,
  ClientToServerEvents,
  Participant,
  QualityPresetKey,
  RoomState,
  ServerToClientEvents,
} from "@/lib/types";

type ParticipantRecord = Participant;

type RoomRecord = {
  roomCode: string;
  hostSocketId: string;
  participants: Map<string, ParticipantRecord>;
  activeShare: boolean;
  currentPreset: QualityPresetKey | null;
  maxParticipants: number;
};

const port = Number(process.env.PORT ?? process.env.SIGNALING_PORT ?? 4000);
const allowedOrigins = (process.env.SIGNALING_ALLOWED_ORIGIN ?? "http://localhost:3000")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const maxParticipants = Math.max(getMaxParticipants(), DEFAULT_MAX_PARTICIPANTS);
const rooms = new Map<string, RoomRecord>();
const AVATAR_COLORS = [
  "#5865f2",
  "#eb459e",
  "#57f287",
  "#fee75c",
  "#ed4245",
  "#00aff4",
];

function buildErrorPayload(
  code: AppErrorPayload["code"],
  message: string,
): AppErrorPayload {
  return { code, message };
}

function toRoomState(room: RoomRecord): RoomState {
  return {
    roomCode: room.roomCode,
    activeShare: room.activeShare,
    currentPreset: room.currentPreset,
    maxParticipants: room.maxParticipants,
    participants: [...room.participants.values()].sort(
      (left, right) => left.joinedAt - right.joinedAt,
    ),
  };
}

function emitRoomState(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  room: RoomRecord,
) {
  io.to(room.roomCode).emit("room:state", toRoomState(room));
}

function getParticipantColor(seed: string): string {
  const total = seed.split("").reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return AVATAR_COLORS[total % AVATAR_COLORS.length] ?? AVATAR_COLORS[0];
}

function createParticipant(
  socketId: string,
  displayName: string,
  role: "host" | "viewer",
): ParticipantRecord {
  return {
    id: socketId,
    displayName: displayName.trim() || (role === "host" ? "Streamer" : "Viewer"),
    role,
    joinedAt: Date.now(),
    color: getParticipantColor(`${displayName}-${socketId}`),
    isMuted: true,
    isCameraOn: false,
  };
}

function getRoomBySocketId(socketId: string): RoomRecord | undefined {
  return [...rooms.values()].find((room) => room.participants.has(socketId));
}

function generateUniqueRoomCode(): string {
  let roomCode = generateRoomCode();

  while (rooms.has(roomCode)) {
    roomCode = generateRoomCode();
  }

  return roomCode;
}

function hasRoomCapacity(room: RoomRecord): boolean {
  return room.participants.size < room.maxParticipants;
}

function buildChatMessage(input: {
  roomCode: string;
  authorId: string | null;
  authorName: string;
  authorColor: string;
  text: string;
  isSystem?: boolean;
}): ChatMessage {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    roomCode: input.roomCode,
    authorId: input.authorId,
    authorName: input.authorName,
    authorColor: input.authorColor,
    text: input.text,
    createdAt: Date.now(),
    isSystem: input.isSystem ?? false,
  };
}

function emitSystemMessage(
  io: Server<ClientToServerEvents, ServerToClientEvents>,
  roomCode: string,
  text: string,
) {
  io.to(roomCode).emit(
    "chat:message",
    buildChatMessage({
      roomCode,
      authorId: null,
      authorName: "System",
      authorColor: "#949ba4",
      text,
      isSystem: true,
    }),
  );
}

const httpServer = createServer();
const io = new Server<ClientToServerEvents, ServerToClientEvents>(httpServer, {
  cors: {
    origin: allowedOrigins,
    credentials: true,
  },
});

io.on("connection", (socket) => {
  socket.on("room:create", ({ roomCode, displayName }) => {
    const normalizedRoomCode = roomCode
      ? normalizeRoomCode(roomCode)
      : generateUniqueRoomCode();

    if (rooms.has(normalizedRoomCode)) {
      socket.emit(
        "error",
        buildErrorPayload(
          "ROOM_EXISTS",
          `Room ${normalizedRoomCode} already exists. Create a fresh room instead.`,
        ),
      );
      return;
    }

    const room: RoomRecord = {
      roomCode: normalizedRoomCode,
      hostSocketId: socket.id,
      participants: new Map(),
      activeShare: false,
      currentPreset: null,
      maxParticipants,
    };

    room.participants.set(
      socket.id,
      createParticipant(socket.id, displayName, "host"),
    );
    rooms.set(normalizedRoomCode, room);
    socket.join(normalizedRoomCode);
    emitRoomState(io, room);
    emitSystemMessage(
      io,
      normalizedRoomCode,
      `Room ${normalizedRoomCode} created. Share this code to invite others.`,
    );
  });

  socket.on("room:join", ({ roomCode, displayName }) => {
    const normalizedRoomCode = normalizeRoomCode(roomCode);
    const room = rooms.get(normalizedRoomCode);

    if (!room) {
      socket.emit(
        "error",
        buildErrorPayload(
          "ROOM_NOT_FOUND",
          `Room ${normalizedRoomCode} was not found. Double-check the host code.`,
        ),
      );
      return;
    }

    if (!room.hostSocketId || !room.participants.has(room.hostSocketId)) {
      socket.emit(
        "error",
        buildErrorPayload("HOST_REQUIRED", "A host must be present before viewers can join."),
      );
      return;
    }

    if (!hasRoomCapacity(room)) {
      socket.emit(
        "error",
        buildErrorPayload(
          "ROOM_FULL",
          `Room ${normalizedRoomCode} is full. Streamzon caps rooms at ${room.maxParticipants} participants.`,
        ),
      );
      return;
    }

    room.participants.set(
      socket.id,
      createParticipant(socket.id, displayName, "viewer"),
    );
    socket.join(normalizedRoomCode);
    emitRoomState(io, room);
    emitSystemMessage(
      io,
      normalizedRoomCode,
      `${displayName.trim() || "A viewer"} joined the room.`,
    );

    if (room.activeShare) {
      io.to(room.hostSocketId).emit("peer:ready", { peerId: socket.id });
    }
  });

  socket.on("share:start", ({ roomCode, preset }) => {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room || room.hostSocketId !== socket.id) {
      socket.emit(
        "error",
        buildErrorPayload(
          "UNAUTHORIZED",
          "Only the active room host can begin screen sharing.",
        ),
      );
      return;
    }

    room.activeShare = true;
    room.currentPreset = preset;
    emitRoomState(io, room);

    for (const participant of room.participants.values()) {
      if (participant.role === "viewer") {
        socket.emit("peer:ready", { peerId: participant.id });
      }
    }
  });

  socket.on("share:stop", ({ roomCode }) => {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room || room.hostSocketId !== socket.id) {
      return;
    }

    room.activeShare = false;
    room.currentPreset = null;
    emitRoomState(io, room);
  });

  socket.on("participant:media-state", ({ roomCode, isMuted, isCameraOn }) => {
    const room = rooms.get(normalizeRoomCode(roomCode));
    const participant = room?.participants.get(socket.id);

    if (!room || !participant) {
      return;
    }

    participant.isMuted = isMuted;
    participant.isCameraOn = isCameraOn;
    emitRoomState(io, room);
  });

  socket.on("chat:send", ({ roomCode, text }) => {
    const room = rooms.get(normalizeRoomCode(roomCode));
    const participant = room?.participants.get(socket.id);
    const normalizedText = text.trim();

    if (!room || !participant || !normalizedText) {
      return;
    }

    io.to(room.roomCode).emit(
      "chat:message",
      buildChatMessage({
        roomCode: room.roomCode,
        authorId: participant.id,
        authorName: participant.displayName,
        authorColor: participant.color,
        text: normalizedText,
      }),
    );
  });

  socket.on("webrtc:offer", ({ roomCode, targetPeerId, sdp }) => {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room || !room.participants.has(targetPeerId)) {
      return;
    }

    io.to(targetPeerId).emit("webrtc:offer", {
      fromPeerId: socket.id,
      sdp,
    });
  });

  socket.on("webrtc:answer", ({ roomCode, targetPeerId, sdp }) => {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room || !room.participants.has(targetPeerId)) {
      return;
    }

    io.to(targetPeerId).emit("webrtc:answer", {
      fromPeerId: socket.id,
      sdp,
    });
  });

  socket.on("webrtc:ice", ({ roomCode, targetPeerId, candidate }) => {
    const room = rooms.get(normalizeRoomCode(roomCode));

    if (!room || !room.participants.has(targetPeerId)) {
      return;
    }

    io.to(targetPeerId).emit("webrtc:ice", {
      fromPeerId: socket.id,
      candidate,
    });
  });

  socket.on("disconnect", () => {
    const room = getRoomBySocketId(socket.id);

    if (!room) {
      return;
    }

    const leavingParticipant = room.participants.get(socket.id);
    room.participants.delete(socket.id);
    socket.leave(room.roomCode);

    if (room.hostSocketId === socket.id) {
      io.to(room.roomCode).emit("room:closed", {
        roomCode: room.roomCode,
        reason: "The host left the room, so the session has been closed.",
      });
      rooms.delete(room.roomCode);
      return;
    }

    room.activeShare = room.activeShare && room.participants.has(room.hostSocketId);
    emitRoomState(io, room);

    if (leavingParticipant) {
      emitSystemMessage(
        io,
        room.roomCode,
        `${leavingParticipant.displayName} left the room.`,
      );
      io.to(room.roomCode).emit("participant:left", {
        participantId: leavingParticipant.id,
      });
    }
  });
});

httpServer.listen(port, () => {
  console.log(
    `[streamzon] signaling server listening on http://localhost:${port} (origins: ${allowedOrigins.join(", ")})`,
  );
});
