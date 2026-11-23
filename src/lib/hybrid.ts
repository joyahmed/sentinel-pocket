// How the home screen degrades when an AI does not answer, so a night never
// stalls: hybrid triage (on-device first, the cloud when Chrome has no model)
// with a small daily cloud budget, and the code-only hard signs as the floor.
// Past the budget, more cloud only when the owner clicks (sort the unsorted
// alerts, or Investigate deeper), paced, and stopping at a used-up quota.
// No React here.
import { hardSigns, type Alert, type Verdict } from "@/lib/triage";

// One tiny on-device prompt before a night starts. The first one after a Chrome
// restart waits up to 30 s, because Gemini Nano can take that long to load
// (status: "warming"). A Nano that misses it is skipped, and re-probed in the
// background every 20 s, a few times; the first answer sends the rest of the
// night back on-device ("ok"). A wedged Nano says "available" and never answers:
// it costs one 30 s wait, then no per-alert waits ("retrying", then "stuck").
export const COLD_PROBE_MS = 30_000;
export const REPROBE_MS = 15_000;
export const REPROBE_EVERY_MS = 20_000;
export const REPROBE_MAX = 3;
export type DeviceHealth = "unknown" | "warming" | "ok" | "retrying" | "stuck";

// Verdict from the code rules alone, for when no AI answered. Only a hard
// sign gives one; anything else stays unsorted (honest, not a guess).
export const ruleVerdict = (a: Alert): Verdict | null => {
  const hard = hardSigns(a);
  return hard.length
    ? { verdict: "danger", reason: `Flagged by rule: ${hard[0]}.`, next_step: "Verify this now. No AI answered, but this is an intruder sign." }
    : null;
};

// ---- Cloud budget ----------------------------------------------------------
// The night pass may get at most CLOUD_BUDGET answers from the cloud per
// browser per day (counted in localStorage under today's date). Past that, the
// rest of the night is on-device only plus the rules. If storage is blocked,
// the count lives in memory for this page session.
export const CLOUD_BUDGET = 3;
const BUDGET_KEY = "sentinel-pocket:cloud-triage:";
let memCount = 0;

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export const cloudUsedToday = () => {
  try {
    return Number(localStorage.getItem(BUDGET_KEY + today()) ?? 0) || 0;
  } catch {
    return memCount;
  }
};

export const cloudBudgetLeft = () => Math.max(0, CLOUD_BUDGET - cloudUsedToday());

// Count one cloud answer of the night pass against today's budget.
export const spendCloudBudget = () => {
  memCount = cloudUsedToday() + 1;
  try {
    localStorage.setItem(BUDGET_KEY + today(), String(memCount));
  } catch {
    // storage blocked: the in-memory count still applies
  }
};

// Why a row is unsorted when the budget kept the cloud out (lib/status reads it).
export const BUDGET_SPENT = `automatic cloud budget used (${CLOUD_BUDGET} a day per browser); no cloud call was made`;

// ---- Cloud pacing ----------------------------------------------------------
// The Gemini free tier is small (about 20 requests a day for the whole project,
// shared by every visitor) and answers 429 under bursts. Cloud calls run one at
// a time with a small gap. A short 429 (a burst) is retried once after the
// server's delay; a long one (the daily quota is used up) stops at once and
// marks the cloud busy until the quota resets, so no more calls are wasted.

// Most alerts the owner can send to the cloud with one click.
export const CLOUD_SORT_MAX = 5;

const CLOUD_GAP_MS = 1_200;
const BACKOFF_MS = 5_000;
const MAX_WAIT_MS = 15_000;
const BUSY_MS = 60_000;

const errText = (e: unknown) => {
  try {
    return `${String(e)} ${JSON.stringify(e)}`;
  } catch {
    return String(e);
  }
};

export const isRateLimit = (e: unknown) => /\b429\b|Too Many Requests|RESOURCE_EXHAUSTED|quota/i.test(errText(e));

// The server's "retry after", in ms, from `retryDelay: "56700s"`, "retry in
// 56700.5s" or "retry in 15h47m". Null when the error does not say.
export const retryAfterMs = (e: unknown): number | null => {
  const t = errText(e);
  const secs = /retryDelay\\?"?\s*:\s*\\?"(\d+(?:\.\d+)?)s/.exec(t) ?? /retry in (\d+(?:\.\d+)?)\s*s\b/i.exec(t);
  if (secs) return Math.ceil(parseFloat(secs[1]) * 1000);
  const hm = /retry in (?:(\d+)\s*h)?\s*(?:(\d+)\s*m)?/i.exec(t);
  return hm && (hm[1] || hm[2]) ? (Number(hm[1] ?? 0) * 60 + Number(hm[2] ?? 0)) * 60_000 : null;
};

// "about 15 h 47 min", "about 3 min", "a few seconds".
export const waitText = (ms: number) => {
  const min = Math.round(ms / 60_000);
  if (min < 1) return "a few seconds";
  const h = Math.floor(min / 60);
  return `about ${h ? `${h} h ` : ""}${min % 60 ? `${min % 60} min` : ""}`.trim();
};

const isDaily = (ms: number | null): ms is number => ms !== null && ms > MAX_WAIT_MS;

export class CloudBusy extends Error {
  readonly retryMs: number | null;
  constructor(retryMs: number | null = null) {
    super(
      isDaily(retryMs)
        ? `429: the free cloud quota is used up for today (resets in ${waitText(retryMs)})`
        : "429: the cloud AI is rate-limited (free tier)",
    );
    this.name = "CloudBusy";
    this.retryMs = retryMs;
  }
}

const retryOf = (e: unknown) => (e instanceof CloudBusy ? e.retryMs : retryAfterMs(e));

// True when a 429 means the day's free quota is gone (not a short burst limit).
export const quotaSpent = (e: unknown) => isDaily(retryOf(e));

// Plain words for a cloud 429, with the reset time when the error gives one.
export const quotaShort = (e: unknown) => {
  const ms = retryOf(e);
  return isDaily(ms)
    ? `The cloud quota is used up for today (it resets in ${waitText(ms)})`
    : "The cloud AI is rate-limited right now (free tier)";
};

export const quotaText = (e: unknown) => `${quotaShort(e)}. ${quotaSpent(e) ? "" : "Wait a minute and try again."}`.trim();

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

let queue: Promise<unknown> = Promise.resolve();
let lastCall = 0;
let busyUntil = 0;
let busyDaily = false;

export const cloudBusy = () => Date.now() < busyUntil;

export function cloudPaced<T>(run: () => Promise<T>): Promise<T> {
  const next = queue.then(async () => {
    for (let attempt = 0; ; attempt++) {
      if (cloudBusy()) throw new CloudBusy(busyDaily ? busyUntil - Date.now() : null);
      const wait = lastCall + CLOUD_GAP_MS - Date.now();
      if (wait > 0) await sleep(wait);
      lastCall = Date.now();
      try {
        return await run();
      } catch (e) {
        if (!isRateLimit(e)) throw e;
        const retry = retryAfterMs(e);
        if (attempt >= 1 || isDaily(retry)) {
          busyDaily = isDaily(retry);
          busyUntil = Date.now() + (busyDaily && retry ? retry : BUSY_MS);
          throw new CloudBusy(busyDaily ? retry : null);
        }
        await sleep(retry ?? BACKOFF_MS);
      }
    }
  });
  queue = next.catch(() => {});
  return next as Promise<T>;
}
