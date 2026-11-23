// How the home screen degrades when an AI does not answer, so a night never
// stalls: on-device first, then the cloud (paced, one 429 retry), then the
// code-only hard signs. No React here.
import { hardSigns, type Alert, type Verdict } from "@/lib/triage";

// One tiny on-device prompt before a night starts. A wedged Gemini Nano says
// "available" and then never answers; this finds out in 8 s, not 20 s per alert.
export const PROBE_TIMEOUT_MS = 8_000;
export type DeviceHealth = "unknown" | "ok" | "stuck";

// Verdict from the code rules alone, for when neither AI answered. Only a hard
// sign gives one; anything else stays unsorted (honest, not a guess).
export const ruleVerdict = (a: Alert): Verdict | null => {
  const hard = hardSigns(a);
  return hard.length
    ? { verdict: "danger", reason: `Flagged by rule: ${hard[0]}.`, next_step: "Verify this now. No AI answered, but this is an intruder sign." }
    : null;
};

// ---- Cloud pacing ----------------------------------------------------------
// The Gemini free tier answers 429 under bursts. Cloud calls run one at a time
// with a small gap; a 429 is retried once after the server's retry delay (or a
// short backoff). A second 429 marks the cloud busy for a minute, so the rest of
// the night goes straight to the rules instead of waiting on it.

const CLOUD_GAP_MS = 1_200;
const BACKOFF_MS = 5_000;
const MAX_WAIT_MS = 15_000;
const BUSY_MS = 60_000;

export class CloudBusy extends Error {
  constructor() {
    super("429: the cloud AI is rate-limited (free tier), so the rules were used");
    this.name = "CloudBusy";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const errText = (e: unknown) => {
  try {
    return `${String(e)} ${JSON.stringify(e)}`;
  } catch {
    return String(e);
  }
};

export const isRateLimit = (e: unknown) => /\b429\b|Too Many Requests|RESOURCE_EXHAUSTED/i.test(errText(e));

const retryAfterMs = (e: unknown) => {
  const m = /retryDelay\\?"?\s*:\s*\\?"(\d+(?:\.\d+)?)s/.exec(errText(e));
  return m ? Math.min(Math.ceil(parseFloat(m[1]) * 1000), MAX_WAIT_MS) : BACKOFF_MS;
};

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
let busyUntil = 0;

export const cloudBusy = () => Date.now() < busyUntil;

export function cloudPaced<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      if (cloudBusy()) throw new CloudBusy();
      const wait = lastCall + CLOUD_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      try {
        return await run();
      } catch (e) {
        if (!isRateLimit(e)) throw e;
        if (attempt >= 1) {
          busyUntil = Date.now() + BUSY_MS;
          throw new CloudBusy();
        }
        await sleep(retryAfterMs(e));
      }
    }
  });
  queue = next.catch(() => {});
  return next as Promise<T>;
}
