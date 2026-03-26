import { DEFAULT_MAX_PARTICIPANTS } from "@/lib/constants";

export function getMaxParticipants(): number {
  const rawValue = process.env.NEXT_PUBLIC_MAX_PARTICIPANTS;
  const parsed = Number(rawValue);

  if (Number.isFinite(parsed) && parsed > 1) {
    return parsed;
  }

  return DEFAULT_MAX_PARTICIPANTS;
}

export function getSignalingUrl(): string {
  return process.env.NEXT_PUBLIC_SIGNALING_URL ?? "http://localhost:4000";
}
