import { notFound } from "next/navigation";

import { RoomPageClient } from "@/components/room-page-client";
import { buildIceServersFromEnv } from "@/lib/ice";
import type { RoomRole } from "@/lib/types";

type RoomPageProps = {
  params: Promise<{ roomCode: string }>;
  searchParams: Promise<{
    role?: string;
    name?: string;
  }>;
};

function toRoomRole(value?: string): RoomRole | null {
  if (value === "host" || value === "viewer") {
    return value;
  }

  return null;
}

export default async function RoomPage({ params, searchParams }: RoomPageProps) {
  const { roomCode } = await params;
  const query = await searchParams;

  if (!roomCode) {
    notFound();
  }

  return (
    <RoomPageClient
      roomCode={roomCode.toUpperCase()}
      initialName={query.name ?? ""}
      initialRole={toRoomRole(query.role)}
      iceServers={buildIceServersFromEnv()}
    />
  );
}
