// What the status strip and the notice line say, from three facts: online,
// on-device model state, and whether dev fixture rows are on screen.
import type { OnDeviceState } from "@/hooks/use-on-device";

export type Tone = "device" | "danger" | "check" | "noise" | "ink";
export type Pill = { key: string; label: string; tone: Tone };
export type Notice = { tone: Tone; text: string } | null;

const DEVICE_PILL: Record<OnDeviceState, Pill> = {
  checking: { key: "device", label: "checking on-device AI", tone: "noise" },
  available: { key: "device", label: "on-device ready", tone: "device" },
  downloadable: { key: "device", label: "on-device not downloaded", tone: "check" },
  downloading: { key: "device", label: "on-device downloading", tone: "check" },
  unavailable: { key: "device", label: "no on-device AI", tone: "check" },
  missing: { key: "device", label: "no on-device AI", tone: "check" },
};

export const statusOf = (online: boolean, onDevice: OnDeviceState, fixture: boolean) => {
  const hasDevice = onDevice === "available";
  const pills: Pill[] = [
    DEVICE_PILL[onDevice],
    online ? { key: "net", label: "online", tone: "noise" } : { key: "net", label: "offline", tone: "danger" },
    ...(fixture ? [{ key: "fixture", label: "dev fixture: fake verdicts", tone: "check" as const }] : []),
  ];

  let notice: Notice = null;
  if (!online && hasDevice) notice = { tone: "device", text: "Offline. Sorting still works: the model lives in this Chrome." };
  else if (!online && onDevice !== "checking")
    notice = { tone: "danger", text: "Offline, and this browser has no on-device AI, so nothing can be sorted right now." };
  else if (onDevice === "downloadable" || onDevice === "downloading")
    notice = { tone: "check", text: "Chrome's on-device model is not ready yet. Until it is, alerts are sorted by Gemini in the cloud." };
  else if (onDevice === "missing" || onDevice === "unavailable")
    notice = {
      tone: "check",
      text: "This browser has no on-device AI. Alerts are sorted by Gemini in the cloud instead, through the same Firebase call. Each answer is labelled with where it ran.",
    };

  return { pills, notice };
};

// A failed verdict, in plain words first; the raw error stays underneath.
export const explainError = (error: string) =>
  /\b429\b|Too Many Requests|quota/i.test(error)
    ? "The cloud AI hit its free-tier rate limit. Wait a minute, then load the night again."
    : "The AI call failed. Load the night again to retry.";
