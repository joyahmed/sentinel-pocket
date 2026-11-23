// Colour classes per tone and per verdict, in one place.
import type { Tone } from "@/lib/status";
import type { Level } from "@/lib/night";

export const TEXT: Record<Tone, string> = {
  device: "text-device",
  danger: "text-danger",
  check: "text-check",
  noise: "text-noise",
  ink: "text-ink",
};

export const LED_BG: Record<Tone, string> = {
  device: "bg-device",
  danger: "bg-danger",
  check: "bg-check",
  noise: "bg-noise-dim",
  ink: "bg-ink",
};

export const CHIP: Record<Level, string> = {
  danger: "bg-danger/15 text-danger",
  check: "bg-check/15 text-check",
  noise: "border border-line-strong text-noise",
};

export const STROKE: Record<Level, string> = {
  danger: "var(--color-danger)",
  check: "var(--color-check)",
  noise: "var(--color-line-strong)",
};
