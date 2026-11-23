// What the status strip and the notice line say, from three facts: online,
// on-device model state, and whether dev fixture rows are on screen.
import type { OnDeviceState } from "@/hooks/use-on-device";
import type { DeviceHealth } from "@/lib/hybrid";

export type Tone = "device" | "danger" | "check" | "noise" | "ink";
export type Pill = { key: string; label: string; tone: Tone };
export type Notice = { tone: Tone; text: string } | null;

const DEVICE_PILL: Record<OnDeviceState, Pill> = {
  checking: { key: "device", label: "checking on-device AI", tone: "noise" },
  available: { key: "device", label: "on-device available", tone: "device" },
  downloadable: { key: "device", label: "on-device not downloaded", tone: "check" },
  downloading: { key: "device", label: "on-device downloading", tone: "check" },
  unavailable: { key: "device", label: "no on-device AI", tone: "check" },
  missing: { key: "device", label: "no on-device AI", tone: "check" },
};

// health: what the triage hook learned by asking Nano this page session (see
// lib/hybrid). "warming": the first probe is waiting for a cold Nano to load.
// "ok" = Nano really answered, the only time the pill says "ready" (availability()
// "available" only means installed, not loaded). "retrying"/"stuck": Chrome says available, but Nano did not answer in time.
export const statusOf = (online: boolean, onDevice: OnDeviceState, fixture: boolean, health: DeviceHealth = "unknown") => {
  const deviceStuck = health === "retrying" || health === "stuck";
  const hasDevice = onDevice === "available" && !deviceStuck;
  const pills: Pill[] = [
    deviceStuck
      ? { key: "device", label: "on-device not answering", tone: "check" }
      : health === "warming"
        ? { key: "device", label: "on-device warming up", tone: "check" }
        : onDevice === "available" && health === "ok"
          ? { key: "device", label: "on-device ready", tone: "device" }
          : DEVICE_PILL[onDevice],
    online ? { key: "net", label: "online", tone: "noise" } : { key: "net", label: "offline", tone: "danger" },
    ...(fixture ? [{ key: "fixture", label: "dev fixture: fake verdicts", tone: "check" as const }] : []),
  ];

  let notice: Notice = null;
  if (!online && hasDevice) notice = { tone: "device", text: "Offline. Sorting still works: the model lives in this Chrome." };
  else if (!online && onDevice !== "checking")
    notice = {
      tone: "danger",
      text: "Offline, and this browser has no working on-device AI. Only the built-in rules can flag alerts right now.",
    };
  else if (health === "warming")
    notice = {
      tone: "device",
      text: "Warming up Chrome's on-device AI... The first night after a Chrome restart can take up to 30 s to start.",
    };
  else if (health === "retrying")
    notice = {
      tone: "check",
      text: "Chrome's on-device AI has not answered yet - the built-in rules flag the clear intruder signs, the rest wait unsorted, and it is checked again in the background.",
    };
  else if (deviceStuck)
    notice = {
      tone: "check",
      text: "Chrome's on-device AI is not answering on this machine - only the built-in rules flagged alerts. Nothing was sent to the cloud.",
    };
  else if (onDevice === "downloadable" || onDevice === "downloading")
    notice = {
      tone: "check",
      text: "Chrome's on-device model is not ready yet. Until it is, the hybrid model asks the cloud for up to 3 alerts a day from this browser, and the built-in rules flag the rest. More cloud only if you ask.",
    };
  else if (onDevice === "missing" || onDevice === "unavailable")
    notice = {
      tone: "check",
      text: "This browser has no on-device AI, so the hybrid model asks the cloud for up to 3 alerts a day from this browser, and the built-in rules flag the rest. More cloud only if you ask. Each answer is labelled with where it ran.",
    };

  return { pills, notice };
};

// A failed verdict, in plain words first; the raw error stays underneath.
const EXPLAIN: [RegExp, (error: string) => string][] = [
  [
    /automatic cloud budget used/,
    () => "The automatic cloud budget for today (3 alerts per browser) is used, and no on-device AI answered. Ask the cloud with the button at the top.",
  ],
  [
    /no cloud call was made/,
    () => "Chrome's on-device AI did not answer, and nothing is sent to the cloud unless you ask (button at the top).",
  ],
  [
    /used up for today/,
    (e) => {
      const reset = /resets in ([^)]*)/.exec(e)?.[1];
      return `The free cloud quota is used up for today${reset ? ` - it resets in ${reset}` : ""}.`;
    },
  ],
  [/\b429\b|Too Many Requests|quota/i, () => "The cloud AI hit its free-tier rate limit. Wait a minute and try again."],
  [/no answer in \d+ ms/, () => "The AI did not answer in time. Load the night again to retry."],
  [/offline|Failed to fetch|NetworkError/i, () => "No network, and no on-device AI answered."],
];

export const explainError = (error: string) =>
  (EXPLAIN.find(([re]) => re.test(error))?.[1] ?? (() => "The AI call failed. Load the night again to retry."))(error);
