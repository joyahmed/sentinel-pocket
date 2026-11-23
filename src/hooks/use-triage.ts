"use client";

// Sorts a night of alerts one by one. Each alert tries, in order: Gemini Nano in
// this Chrome (the hybrid model), Gemini in the cloud (paced, see lib/hybrid),
// then the code hard signs alone. Each row records the verdict, where it came
// from (on_device, in_cloud, rule) and how long it took. A wedged Nano is found
// by one short probe before the first night and is not asked again this page
// session. Loading a new set or pressing stop abandons the current run.
import { useEffect, useRef, useState } from "react";
import { cloudTriageModel, triageModel } from "@/lib/firebase";
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
import { CloudBusy, PROBE_TIMEOUT_MS, cloudPaced, ruleVerdict, type DeviceHealth } from "@/lib/hybrid";
import type { RowSource, TriageRow } from "@/lib/night";
import { DEFAULT_NOTES } from "@/hooks/use-eval";

type Route = "device" | "cloud";
type LanguageModelApi = { availability: (opts?: object) => Promise<string> };

// Page-session memory: once Nano fails to answer it stays skipped until reload.
let health: DeviceHealth = "unknown";
let probed = false;

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

// Why no AI answered, in a form explainError (lib/status) can read.
const whyText = (e: unknown) =>
  e instanceof TriageTimeout || e instanceof CloudBusy ? e.message : e instanceof Error ? e.message : String(e ?? "no AI answered");

const useTriage = () => {
  const [rows, setRows] = useState<TriageRow[]>([]);
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [fixture, setFixture] = useState(false);
  const [deviceHealth, setDeviceHealth] = useState<DeviceHealth>(health);
  const runId = useRef(0);

  const patch = (i: number, next: Partial<TriageRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...next } : r)));

  const setHealth = (h: DeviceHealth) => {
    health = h;
    setDeviceHealth(h);
  };

  const ask = async (text: string, route: Route) => {
    const r =
      route === "device"
        ? await withTimeout(() => triageModel().generateContent(text))
        : await cloudPaced(() => withTimeout(() => cloudTriageModel().generateContent(text)));
    return { verdict: parseVerdict(r.response.text()), source: r.response.inferenceSource as RowSource };
  };

  // One tiny on-device prompt with a short limit. A miss marks Nano "stuck".
  const probe = async () => {
    probed = true;
    try {
      const r = await withTimeout(() => triageModel().generateContent(PROBE_TEXT), PROBE_TIMEOUT_MS);
      if (r.response.inferenceSource === "on_device") setHealth("ok");
    } catch {
      setHealth("stuck");
    }
  };

  // Pass 1 on the best route left. A device timeout marks Nano stuck and the
  // same alert goes to the cloud. `result` is null when no AI answered.
  const firstPass = async (text: string) => {
    let why: unknown;
    if (health === "ok") {
      try {
        return { result: await ask(text, "device"), why };
      } catch (e) {
        why = e;
        if (e instanceof TriageTimeout) setHealth("stuck");
      }
    }
    if (!navigator.onLine) return { result: null, why: why ?? new Error("offline") };
    try {
      return { result: await ask(text, "cloud"), why };
    } catch (e) {
      return { result: null, why: e };
    }
  };

  // Two passes (see mergeVerdicts in lib/triage): pass 1 without the house notes;
  // only a "danger" or "check" with no hard sign gets pass 2, where the notes may
  // lower it to "noise" and nothing else. A failed pass 2 keeps the pass-1 verdict.
  // When no AI answers, a hard sign alone gives "danger" (source "rule"); any
  // other alert is left "unsorted" for the owner to read.
  const askOne = async (a: Alert, i: number, live: () => boolean) => {
    const set = (next: Partial<TriageRow>) => live() && patch(i, next);
    set({ status: "sorting" });
    const t0 = performance.now();
    const ms = () => Math.round(performance.now() - t0);
    const hard = hardSigns(a);
    const rule = ruleVerdict(a);
    const { result: p1, why } = await firstPass(alertText(a, ""));
    if (!p1) {
      const error = whyText(why);
      return set(rule ? { status: "done", verdict: rule, source: "rule", ms: ms(), error } : { status: "unsorted", error, ms: ms() });
    }
    let verdict = p1.verdict;
    if (verdict && hard.length) {
      verdict = { ...verdict, verdict: "danger", reason: `Hard sign: ${hard[0]}. ${verdict.reason}` };
    } else if (verdict && verdict.verdict !== "noise" && notes.trim()) {
      const route: Route = p1.source === "on_device" && health === "ok" ? "device" : "cloud";
      const p2 = await ask(secondLookText(a, notes, verdict.verdict), route).catch((e) => {
        if (route === "device" && e instanceof TriageTimeout) setHealth("stuck");
        return null;
      });
      if (p2?.verdict && mergeVerdicts(verdict.verdict, p2.verdict.verdict, hard) === "noise") verdict = p2.verdict;
    }
    if (verdict) return set({ status: "done", verdict, source: p1.source, ms: ms() });
    const error = "The model's answer was not a valid verdict.";
    set(rule ? { status: "done", verdict: rule, source: "rule", ms: ms(), error } : { status: "error", error, ms: ms() });
  };

  const load = async (alerts: Alert[]) => {
    const id = ++runId.current;
    const live = () => runId.current === id;
    setFixture(false);
    setRows(alerts.map((alert) => ({ alert, status: "waiting" })));
    setRunning(true);
    if (!probed && (await nanoAvailable())) await probe();
    for (const [i, a] of alerts.entries()) {
      if (!live()) return;
      await askOne(a, i, live);
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

  return { rows, running, notes, setNotes, fixture, deviceHealth, load, stop };
};

export default useTriage;
