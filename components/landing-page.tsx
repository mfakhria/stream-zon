"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  ArrowRight,
  Monitor,
  Tv2,
  Users,
  Zap,
} from "lucide-react";

import { generateRoomCode, normalizeRoomCode } from "@/lib/room-code";

function buildSearchParams(role: "host" | "viewer", name: string): string {
  const searchParams = new URLSearchParams({
    role,
    name: name.trim(),
  });

  return searchParams.toString();
}

const LOBBY_STATS = [
  {
    icon: Monitor,
    label: "Screen Share",
    description: "HD quality",
    accent: "#5865f2",
  },
  {
    icon: Users,
    label: "Up to 5",
    description: "Participants",
    accent: "#eb459e",
  },
  {
    icon: Zap,
    label: "Ultra-low",
    description: "Latency",
    accent: "#57f287",
  },
] as const;

const WATCHING_USERS: ReadonlyArray<{
  initial: string;
  color: string;
  textColor?: string;
}> = [
  { initial: "A", color: "#5865f2" },
  { initial: "J", color: "#eb459e" },
  { initial: "M", color: "#57f287", textColor: "#0f172a" },
  { initial: "R", color: "#fee75c", textColor: "#0f172a" },
];

export function LandingPage() {
  const router = useRouter();
  const [isNavigating, startTransition] = useTransition();
  const [hostName, setHostName] = useState("");
  const [hostError, setHostError] = useState("");
  const [joinName, setJoinName] = useState("");
  const [roomCode, setRoomCode] = useState("");
  const [joinError, setJoinError] = useState("");

  const previewRoomCode = "A3XK9P";
  const normalizedRoomCode = useMemo(() => normalizeRoomCode(roomCode), [roomCode]);

  function navigateToRoom(role: "host" | "viewer", code: string, name: string) {
    startTransition(() => {
      router.push(`/room/${code}?${buildSearchParams(role, name)}`);
    });
  }

  function handleHostRoom() {
    const name = hostName.trim();

    if (!name) {
      setHostError("Please enter your display name");
      return;
    }

    setHostError("");
    navigateToRoom("host", generateRoomCode(), name);
  }

  function handleJoinRoom() {
    const name = joinName.trim();

    if (!name) {
      setJoinError("Please enter your display name");
      return;
    }

    if (!normalizedRoomCode || normalizedRoomCode.length < 4) {
      setJoinError("Please enter a valid room code");
      return;
    }

    setJoinError("");
    navigateToRoom("viewer", normalizedRoomCode, name);
  }

  return (
    <div className="min-h-screen bg-[#1e1f22] text-white">
      <nav className="border-b border-[#3f4147]/50 px-6 py-5 md:px-8">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5865f2] shadow-lg shadow-[#5865f2]/30">
              <Tv2 size={19} className="text-white" />
            </div>
            <div>
              <span className="text-[1.05rem] font-semibold tracking-tight">
                Streamzon
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 text-sm text-[#949ba4]">
            <span>No account needed</span>
            <div className="h-2 w-2 animate-pulse rounded-full bg-[#57f287]" />
          </div>
        </div>
      </nav>

      <main className="px-6 py-12 md:px-8 lg:py-16">
        <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-12">
          <section className="space-y-8">
            <div className="space-y-5">
              <div className="inline-flex items-center gap-2 rounded-full border border-[#5865f2]/30 bg-[#5865f2]/15 px-4 py-2">
                <Zap size={12} className="text-[#5865f2]" />
                <span className="text-xs font-medium text-[#5865f2]">
                  Real-time screen sharing
                </span>
              </div>

              <div className="space-y-4">
                <h1 className="max-w-[10ch] text-[clamp(2.6rem,6vw,5rem)] font-bold leading-[0.98] tracking-[-0.05em] text-white">
                  Watch Together,
                  <span className="block bg-gradient-to-r from-[#5865f2] via-[#8b5cf6] to-[#eb459e] bg-clip-text text-transparent">
                    Anywhere
                  </span>
                </h1>
                <p className="max-w-xl text-lg leading-8 text-[#b5bac1]">
                  Share your screen instantly with friends. No sign-up, no downloads
                  just create a room and share the code.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-5">
              {LOBBY_STATS.map(({ icon: Icon, label, description, accent }) => (
                <div key={label} className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-[#3f4147] bg-[#2b2d31]">
                    <Icon size={18} style={{ color: accent }} />
                  </div>
                  <div>
                    <p className="text-base font-semibold text-white">{label}</p>
                    <p className="text-sm text-[#949ba4]">{description}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="hidden rounded-[1.7rem] border border-[#3f4147] bg-[#2b2d31] p-5 lg:block">
              <div className="mb-4 flex items-center gap-2">
                <div className="h-3 w-3 rounded-full bg-[#ed4245]" />
                <div className="h-3 w-3 rounded-full bg-[#fee75c]" />
                <div className="h-3 w-3 rounded-full bg-[#57f287]" />
                <div className="ml-3 flex h-7 flex-1 items-center rounded-md bg-[#1e1f22] px-3">
                  <span className="text-[0.72rem] text-[#949ba4]">
                    streamzon.app/room/{previewRoomCode}
                  </span>
                </div>
              </div>

              <div className="flex h-40 items-center justify-center rounded-2xl border border-[#3f4147]/60 bg-[#1e1f22]">
                <div className="space-y-3 text-center">
                  <Monitor size={34} className="mx-auto text-[#5865f2]" />
                  <p className="text-sm text-[#949ba4]">Screen sharing active</p>
                </div>
              </div>

              <div className="mt-4 flex items-center gap-2">
                {WATCHING_USERS.map((user) => (
                  <div
                    key={user.initial}
                    className="flex h-9 w-9 items-center justify-center rounded-full text-xs font-semibold"
                    style={{
                      backgroundColor: user.color,
                      color: user.textColor ?? "#ffffff",
                    }}
                  >
                    {user.initial}
                  </div>
                ))}
                <span className="ml-2 text-sm text-[#949ba4]">4 watching</span>
                <div className="ml-auto flex items-center gap-2 text-sm text-[#57f287]">
                  <div className="h-2 w-2 rounded-full bg-[#57f287]" />
                  <span>Live</span>
                </div>
              </div>
            </div>
          </section>

          <section className="space-y-5">
            <div className="rounded-[1.8rem] border border-[#3f4147] bg-[#2b2d31] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.22)] md:p-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#5865f2]/20">
                      <Monitor size={18} className="text-[#5865f2]" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#5865f2]">
                      Host Room
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-bold tracking-[-0.03em] text-white">
                      Start a session
                    </h2>
                    <p className="text-base leading-7 text-[#aab0b9]">
                      Create a room and share the code with your friends.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-[#dbdee1]">
                    Your display name
                  </label>
                  <input
                    type="text"
                    value={hostName}
                    onChange={(event) => {
                      setHostName(event.target.value);
                      setHostError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleHostRoom();
                      }
                    }}
                    placeholder="e.g. Alex"
                    className="w-full rounded-2xl border border-[#3f4147] bg-[#1e1f22] px-4 py-3 text-sm text-[#dbdee1] outline-none transition focus:border-[#5865f2] focus:ring-2 focus:ring-[#5865f2]/30"
                  />
                  {hostError ? (
                    <p className="text-xs text-[#ed4245]">{hostError}</p>
                  ) : null}
                </div>

                <button
                  onClick={handleHostRoom}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#5865f2] px-4 py-3 text-base font-semibold text-white shadow-lg shadow-[#5865f2]/20 transition hover:bg-[#4752c4] active:bg-[#3c45a5] disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isNavigating}
                  type="button"
                >
                  Create room
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>

            <div className="flex items-center gap-4 px-1">
              <div className="h-px flex-1 bg-[#3f4147]" />
              <span className="text-xs font-medium uppercase tracking-[0.2em] text-[#949ba4]">
                or
              </span>
              <div className="h-px flex-1 bg-[#3f4147]" />
            </div>

            <div className="rounded-[1.8rem] border border-[#3f4147] bg-[#2b2d31] p-6 shadow-[0_18px_60px_rgba(0,0,0,0.18)] md:p-8">
              <div className="space-y-5">
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#eb459e]/20">
                      <Users size={18} className="text-[#eb459e]" />
                    </div>
                    <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[#eb459e]">
                      Join Room
                    </span>
                  </div>
                  <div className="space-y-2">
                    <h2 className="text-4xl font-bold tracking-[-0.03em] text-white">
                      Join a session
                    </h2>
                    <p className="text-base leading-7 text-[#aab0b9]">
                      Enter the room code from your host to connect.
                    </p>
                  </div>
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-[#dbdee1]">
                    Your display name
                  </label>
                  <input
                    type="text"
                    value={joinName}
                    onChange={(event) => {
                      setJoinName(event.target.value);
                      setJoinError("");
                    }}
                    placeholder="e.g. Jordan"
                    className="w-full rounded-2xl border border-[#3f4147] bg-[#1e1f22] px-4 py-3 text-sm text-[#dbdee1] outline-none transition focus:border-[#eb459e] focus:ring-2 focus:ring-[#eb459e]/25"
                  />
                </div>

                <div className="space-y-3">
                  <label className="block text-sm font-medium text-[#dbdee1]">
                    Room code
                  </label>
                  <input
                    type="text"
                    value={roomCode}
                    onChange={(event) => {
                      setRoomCode(event.target.value.toUpperCase());
                      setJoinError("");
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        handleJoinRoom();
                      }
                    }}
                    placeholder="e.g. A3XK9P"
                    maxLength={8}
                    className="w-full rounded-2xl border border-[#3f4147] bg-[#1e1f22] px-4 py-3 text-sm uppercase tracking-[0.35em] text-[#dbdee1] outline-none transition placeholder:tracking-normal focus:border-[#eb459e] focus:ring-2 focus:ring-[#eb459e]/25"
                  />
                  {joinError ? (
                    <p className="text-xs text-[#ed4245]">{joinError}</p>
                  ) : null}
                </div>

                <button
                  onClick={handleJoinRoom}
                  className="flex w-full items-center justify-center gap-2 rounded-2xl border border-[#eb459e]/40 bg-[#eb459e]/10 px-4 py-3 text-base font-semibold text-[#eb459e] transition hover:border-[#eb459e]/60 hover:bg-[#eb459e]/20 disabled:cursor-not-allowed disabled:opacity-60"
                  disabled={isNavigating}
                  type="button"
                >
                  Join with code
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          </section>
        </div>
      </main>

      <footer className="border-t border-[#3f4147]/30 px-6 py-4 text-center text-xs text-[#949ba4] md:px-8">
        Streamzon · No account required · Room-based WebRTC screen sharing
      </footer>
    </div>
  );
}
