"use client";

// Sorts a night of alerts one by one with the HYBRID triage model
// (PREFER_ON_DEVICE: Gemini Nano in this Chrome, the cloud when Chrome has no
// model), under a cloud budget of CLOUD_BUDGET answers per browser per day.
// Past the budget the rest of the night is on-device only; the code hard signs
// are the floor (a hard sign gives "danger", anything else stays "unsorted").
// A wedged Nano is never asked through the hybrid model (it would hang on
// device): rules only. More cloud only on a click: the owner can ask the cloud
// to sort up to CLOUD_SORT_MAX unsorted alerts (the free tier is about 20 calls
// a day, shared by every visitor). A daily-quota 429 stops all cloud use for
// the page session. Each row records the verdict, where it came from
// (on_device, in_cloud, rule) and how long it took. One probe before the first night lets a cold Nano load (up
// to 30 s); a Nano that misses it is re-probed in the background, and when it
// answers, the alerts still unsorted are sorted on-device (lib/hybrid).
// Loading a new set or pressing stop abandons the current run.
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cloudTriageModel, deviceTriageModel, triageModel } from "@/lib/firebase";
import {
  type Alert,
  EN_TEXT,
  TriageTimeout,
  alertText,
  hardSigns,
  mergeVerdicts,
  parseVerdict,
  secondLookText,
  withTimeout,
} from "@/lib/triage";
import {
  BUDGET_SPENT,
  CLOUD_SORT_MAX,
  COLD_PROBE_MS,
  CloudBusy,
  REPROBE_EVERY_MS,
  REPROBE_MAX,
  REPROBE_MS,
  cloudBudgetLeft,
  cloudBusy,
  cloudPaced,
  isRateLimit,
  quotaShort,
  quotaSpent,
  ruleVerdict,
  spendCloudBudget,
  type DeviceHealth,
} from "@/lib/hybrid";
import type { RowSource, RowStatus, TriageRow } from "@/lib/night";
import { scrubBundle } from "@/lib/scrub";
import { DEFAULT_NOTES } from "@/hooks/use-eval";

type Route = "hybrid" | "device" | "cloud";
type LanguageModelApi = { availability: (opts?: object) => Promise<string> };
export type CloudNote = { text: string; spent: boolean } | null;

// Why a row is unsorted when Nano was not asked (lib/status explainError reads it).
export const NO_DEVICE = "on-device AI not answering; no cloud call was made";

// Page-session memory of Nano's health, shared by every hook instance. Changes
// can come from a background re-probe, so React reads it as an external store.
let health: DeviceHealth = "unknown";
let coldProbe: Promise<void> | null = null;
let reprobes = 0;
let reprobing = false;
// The 429 that stopped the cloud this page session, if any.
let cloudStop: unknown = null;
const listeners = new Set<() => void>();
const subscribe = (f: () => void) => {
  listeners.add(f);
  return () => {
    listeners.delete(f);
  };
};
const getHealth = () => health;
const serverHealth = (): DeviceHealth => "unknown";

const setHealth = (h: DeviceHealth) => {
  health = h;
  listeners.forEach((f) => f());
};

// Resolves when a pending re-probe has an outcome: "ok" (Nano is back), or
// anything else (stuck, never probed).
const settled = () =>
  new Promise<DeviceHealth>((resolve) => {
    if (health !== "retrying" && health !== "warming") return resolve(health);
    const f = () => {
      if (health === "retrying" || health === "warming") return;
      listeners.delete(f);
      resolve(health);
    };
    listeners.add(f);
  });

const nanoAvailable = async () => {
  const LM = (globalThis as unknown as { LanguageModel?: LanguageModelApi }).LanguageModel;
  try {
    return LM ? (await LM.availability(EN_TEXT)) === "available" : false;
  } catch {
    return false;
  }
};

const PROBE_TEXT = alertText(
  { id: "probe", time: "now", rule: "probe", severity: "info", summary: "Health check: the watchdog saved its own state file." },
  "",
);

// One tiny on-device prompt (ONLY_ON_DEVICE model, so it never spends cloud
// quota). true: Nano answered in time.
const probeOnce = async (ms: number) => {
  try {
    await withTimeout(() => deviceTriageModel().generateContent(PROBE_TEXT), ms);
    return true;
  } catch {
    return false;
  }
};

const settle = (answered: boolean) => (answered ? setHealth("ok") : reprobeLater());

// Nano missed a probe or an alert: skip it, and ask again in the background
// every REPROBE_EVERY_MS, at most REPROBE_MAX times this page session. This
// never blocks a night; the alert loop reads `health` before each alert.
const reprobeLater = () => {
  if (reprobing) return;
  if (reprobes >= REPROBE_MAX) return setHealth("stuck");
  reprobing = true;
  setHealth("retrying");
  setTimeout(async () => {
    reprobes++;
    const answered = await probeOnce(REPROBE_MS);
    reprobing = false;
    settle(answered);
  }, REPROBE_EVERY_MS);
};

// The first probe of the page session waits long enough for a cold Nano to load.
const warmUp = () =>
  (coldProbe ??= (async () => {
    if (!(await nanoAvailable())) return;
    setHealth("warming");
    settle(await probeOnce(COLD_PROBE_MS));
  })());

// Why no AI answered, in a form explainError (lib/status) can read.
const whyText = (e: unknown) =>
  e instanceof TriageTimeout || e instanceof CloudBusy ? e.message : e instanceof Error ? e.message : String(e ?? "no AI answered");

const useTriage = () => {
  const [rows, setRows] = useState<TriageRow[]>([]);
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [fixture, setFixture] = useState(false);
  const [cloudNote, setCloudNote] = useState<CloudNote>(null);
  const deviceHealth = useSyncExternalStore(subscribe, getHealth, serverHealth);
  const runId = useRef(0);

  const patch = (i: number, next: Partial<TriageRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...next } : r)));

  // "hybrid": PREFER_ON_DEVICE. When Nano is not "ok" the SDK will go to the
  // cloud, so the call is paced like any cloud call and gets the scrubbed text
  // (IPs, user and app names, secret paths replaced, lib/scrub): raw alerts
  // never leave this machine. A cloud answer of the hybrid model is counted
  // against today's budget.
  const ask = async (text: string, route: Route, cloudText = text) => {
    const r =
      route === "device"
        ? await withTimeout(() => deviceTriageModel().generateContent(text))
        : route === "hybrid" && health === "ok"
          ? await withTimeout(() => triageModel().generateContent(text))
          : await cloudPaced(() =>
              withTimeout(() => (route === "hybrid" ? triageModel() : cloudTriageModel()).generateContent(cloudText)),
            );
    const source = r.response.inferenceSource as RowSource;
    if (route === "hybrid" && source === "in_cloud") spendCloudBudget();
    return { verdict: parseVerdict(r.response.text()), source };
  };

  // Pass 1. Nano answering: hybrid while the cloud budget lasts, then on-device
  // only. No Nano at all: hybrid (it goes to the cloud) while the budget lasts.
  // Nano wedged ("warming", "retrying", "stuck"): no AI call, the rules decide.
  // A device timeout sends Nano back to background re-probing; a 429 stops the
  // cloud. `result` is null when no AI answered.
  const firstPass = async (a: Alert) => {
    const cloudOpen = cloudBudgetLeft() > 0 && !cloudBusy();
    const route: Route | null = health === "ok" ? (cloudOpen ? "hybrid" : "device") : health === "unknown" && cloudOpen ? "hybrid" : null;
    if (!route) {
      const why = health !== "unknown" ? NO_DEVICE : cloudBusy() && cloudStop ? cloudStop : BUDGET_SPENT;
      return { result: null, why: (typeof why === "string" ? new Error(why) : why) as unknown };
    }
    const onDevice = health === "ok";
    try {
      return { result: await ask(alertText(a, ""), route, scrubBundle([a]).text), why: null as unknown };
    } catch (e) {
      if (onDevice && e instanceof TriageTimeout) reprobeLater();
      if (e instanceof CloudBusy || isRateLimit(e)) stopCloud(e);
      return { result: null, why: e };
    }
  };

  // A 429 in the night pass: no more cloud this session, said in plain words.
  const stopCloud = (e: unknown) => {
    cloudStop = e;
    setCloudNote({ text: `${quotaShort(e)} - no more cloud calls; the built-in rules still flag the clear intruder signs.`, spent: quotaSpent(e) });
  };

  // Two passes (see mergeVerdicts in lib/triage): pass 1 without the house notes;
  // only a "danger" or "check" with no hard sign gets pass 2, where the notes may
  // lower it to "noise" and nothing else. A failed pass 2 keeps the pass-1 verdict.
  // Pass 2 runs on-device only; a cloud pass 1 gets none, to spend less quota.
  // When Nano does not answer, a hard sign alone gives "danger" (source "rule");
  // any other alert is left "unsorted". Returns the row's final status.
  const askOne = async (a: Alert, i: number, live: () => boolean): Promise<RowStatus> => {
    const set = (next: Partial<TriageRow>) => live() && patch(i, next);
    set({ status: "sorting" });
    const t0 = performance.now();
    const ms = () => Math.round(performance.now() - t0);
    const hard = hardSigns(a);
    const rule = ruleVerdict(a);
    const { result: p1, why } = await firstPass(a);
    if (!p1) {
      const error = whyText(why);
      set(rule ? { status: "done", verdict: rule, source: "rule", ms: ms(), error } : { status: "unsorted", error, ms: ms() });
      return rule ? "done" : "unsorted";
    }
    let verdict = p1.verdict;
    if (verdict && hard.length) {
      verdict = { ...verdict, verdict: "danger" };
    } else if (verdict && verdict.verdict !== "noise" && notes.trim() && p1.source === "on_device" && health === "ok") {
      const p2 = await ask(secondLookText(a, notes, verdict.verdict), "device").catch((e) => {
        if (e instanceof TriageTimeout) reprobeLater();
        return null;
      });
      if (p2?.verdict && mergeVerdicts(verdict.verdict, p2.verdict.verdict, hard) === "noise") verdict = p2.verdict;
    }
    if (verdict) {
      set({ status: "done", verdict, source: p1.source, ms: ms(), error: undefined });
      return "done";
    }
    const error = "The model's answer was not a valid verdict.";
    set(rule ? { status: "done", verdict: rule, source: "rule", ms: ms(), error } : { status: "error", error, ms: ms() });
    return rule ? "done" : "error";
  };

  // Sort the given rows (hybrid, budgeted); returns the ones left unsorted.
  const sortOnDevice = async (alerts: Alert[], idx: number[], live: () => boolean) => {
    const left: number[] = [];
    for (const i of idx) {
      if (!live()) return [];
      if ((await askOne(alerts[i], i, live)) === "unsorted") left.push(i);
    }
    return left;
  };

  // A night that ended with unsorted rows while Nano was being re-probed: when
  // the re-probe gets an answer, sort those rows again (Nano answers, so the
  // hybrid model stays on this device).
  const resumeWhenBack = async (alerts: Alert[], left: number[], live: () => boolean) => {
    while (left.length && live() && (await settled()) === "ok" && live()) {
      setRunning(true);
      left = await sortOnDevice(alerts, left, live);
      if (live()) setRunning(false);
    }
  };

  const load = async (alerts: Alert[]) => {
    const id = ++runId.current;
    const live = () => runId.current === id;
    setFixture(false);
    setCloudNote(null);
    setRows(alerts.map((alert) => ({ alert, status: "waiting" })));
    setRunning(true);
    await warmUp();
    if (!live()) return;
    const left = await sortOnDevice(alerts, [...alerts.keys()], live);
    if (!live()) return;
    setRunning(false);
    void resumeWhenBack(alerts, left, live);
  };

  // Only on an explicit click: send up to CLOUD_SORT_MAX unsorted alerts to the
  // cloud, one paced call each (no second look, to spend less of the shared
  // quota). A 429 stops the batch at once and says so in plain words.
  const sortInCloud = async () => {
    if (running) return;
    const id = ++runId.current;
    const live = () => runId.current === id;
    const picks = rows.flatMap((r, i) => (r.status === "unsorted" ? [i] : [])).slice(0, CLOUD_SORT_MAX);
    const flagged = rows.filter((r) => r.source === "rule").length;
    setCloudNote(null);
    setRunning(true);
    for (const i of picks) {
      if (!live()) return;
      const a = rows[i].alert;
      patch(i, { status: "sorting" });
      const t0 = performance.now();
      try {
        const p1 = await ask(alertText(a, ""), "cloud", scrubBundle([a]).text);
        const ms = Math.round(performance.now() - t0);
        if (!live()) return;
        patch(i, p1.verdict ? { status: "done", verdict: p1.verdict, source: p1.source, ms, error: undefined } : { status: "error", error: "The model's answer was not a valid verdict.", ms });
      } catch (e) {
        if (!live()) return;
        patch(i, { status: "unsorted", error: whyText(e) });
        if (e instanceof CloudBusy || isRateLimit(e)) {
          cloudStop = e;
          setCloudNote({
            text: `${quotaShort(e)} - the built-in rules still flagged ${flagged} ${flagged === 1 ? "alert" : "alerts"}.`,
            spent: quotaSpent(e),
          });
          break;
        }
      }
    }
    if (live()) setRunning(false);
  };

  const stop = () => {
    runId.current++;
    setRunning(false);
    setRows((prev) => prev.map((r) => (r.status === "sorting" ? { ...r, status: "waiting" } : r)));
  };

  // Dev-only: /?fixture=1 fills the screen with verdicts made from the dataset's
  // labels, for screenshots where Chrome has no on-device model. The import is
  // dead code in a production build.
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    if (!new URLSearchParams(window.location.search).has("fixture")) return;
    import("@/dev/fixture").then(({ fixtureRows }) => {
      setRows(fixtureRows());
      setFixture(true);
    });
  }, []);

  return { rows, running, notes, setNotes, fixture, deviceHealth, cloudNote, load, stop, sortInCloud };
};

export default useTriage;
