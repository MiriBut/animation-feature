// src/config/constants.ts

import { Resolution } from "../types";

export const SUPPORTED_RESOLUTIONS: Resolution[] = [
  { label: "16:9", width: 1920, height: 1080 },
  { label: "9:16", width: 1080, height: 1920 },
  { label: "1:1", width: 1080, height: 1080 },
];

export const DEFAULT_ASSETS = {
  background: {
    key: "default-bg",
    path: "assets/images/default-background.jpg",
  },
  music: {
    key: "default-bg-music",
    path: "assets/sounds/default-bg-music.wav",
  },
} as const;

export const RECORDING_DURATION = 10000; // 10 seconds

export const SUPPORTED_AUDIO_FORMATS = [
  "audio/mpeg", // .mp3
  "audio/wav", // .wav
  "audio/ogg", // .ogg
] as const;

export const SUPPORTED_VIDEO_CODECS = [
  "video/webm;codecs=vp9,opus",
  "video/webm;codecs=vp8,opus",
  "video/webm;codecs=h264,opus",
  "video/webm",
] as const;

export const MAX_AUDIO_FILE_SIZE = 20 * 1024 * 1024; // 20MB

export const AUDIO_SETTINGS = {
  defaultVolume: 0.5,
  fadeInDuration: 1000, // 1 second
  fadeOutDuration: 1000, // 1 second
} as const;

export const RECORDING_SETTINGS = {
  videoBitrate: 8000000, // 8 Mbps
  audioBitrate: 128000, // 128 kbps
  duration: 10000, // 10 seconds
} as const;
