import type { QualityPresetConfig, QualityPresetKey } from "@/lib/types";

export const DEFAULT_MAX_PARTICIPANTS = 5;
export const ROOM_CODE_LENGTH = 6;

export const QUALITY_PRESETS: Record<QualityPresetKey, QualityPresetConfig> = {
  "720p30": {
    key: "720p30",
    label: "720p / 30 FPS",
    width: 1280,
    height: 720,
    frameRate: 30,
    idealBandwidthMbps: "1.5 - 2 Mbps",
  },
  "720p60": {
    key: "720p60",
    label: "720p / 60 FPS",
    width: 1280,
    height: 720,
    frameRate: 60,
    idealBandwidthMbps: "2.5 - 3 Mbps",
  },
  "1080p30": {
    key: "1080p30",
    label: "1080p / 30 FPS",
    width: 1920,
    height: 1080,
    frameRate: 30,
    idealBandwidthMbps: "3.5 - 4 Mbps",
  },
  "1080p60": {
    key: "1080p60",
    label: "1080p / 60 FPS",
    width: 1920,
    height: 1080,
    frameRate: 60,
    idealBandwidthMbps: "5 - 6 Mbps",
  },
};

export const QUALITY_BITRATES: Record<QualityPresetKey, number> = {
  "720p30": 2_000_000,
  "720p60": 3_000_000,
  "1080p30": 4_000_000,
  "1080p60": 6_000_000,
};

export const QUALITY_OPTIONS = Object.values(QUALITY_PRESETS);
