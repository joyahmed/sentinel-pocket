"use client";

// Sorts a night of alerts one by one through the hybrid triage model (on-device
// first, cloud fallback - see lib/firebase.ts). Each row records the verdict,
// where it ran (inferenceSource) and how long it took. Loading a new set or
// pressing stop abandons the current run.
import { useEffect, useRef, useState } from "react";
import { triageModel } from "@/lib/firebase";
import {
  type Alert,
  TriageTimeout,
  alertText,
  hardSigns,
  mergeVerdicts,
  parseVerdict,
  secondLookText,
  withTimeout,
} from "@/lib/triage";
import type { TriageRow } from "@/lib/night";
import { DEFAULT_NOTES } from "@/hooks/use-eval";

const useTriage = () => {
  const [rows, setRows] = useState<TriageRow[]>([]);
  const [running, setRunning] = useState(false);
  const [notes, setNotes] = useState(DEFAULT_NOTES);
  const [fixture, setFixture] = useState(false);
  const runId = useRef(0);

  const patch = (i: number, next: Partial<TriageRow>) =>
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...next } : r)));

  const ask = async (text: string) => {
    const r = await withTimeout(() => triageModel().generateContent(text));
    return { verdict: parseVerdict(r.response.text()), source: r.response.inferenceSource };
  };

  // Two passes (see mergeVerdicts in lib/triage): pass 1 without the house notes;
  // only a "danger" or "check" with no hard sign gets pass 2, where the notes may
  // lower it to "noise" and nothing else. A failed pass 2 keeps the pass-1 verdict.
  const askOne = async (a: Alert, i: number) => {
    patch(i, { status: "sorting" });
    const t0 = performance.now();
    try {
      const hard = hardSigns(a);
      const p1 = await ask(alertText(a, ""));
      let verdict = p1.verdict;
      if (verdict && hard.length) {
        verdict = { ...verdict, verdict: "danger", reason: `Hard sign: ${hard[0]}. ${verdict.reason}` };
      } else if (verdict && verdict.verdict !== "noise" && notes.trim()) {
        const p2 = await ask(secondLookText(a, notes, verdict.verdict)).catch(() => null);
        if (p2?.verdict && mergeVerdicts(verdict.verdict, p2.verdict.verdict, hard) === "noise") verdict = p2.verdict;
      }
      const ms = Math.round(performance.now() - t0);
      patch(
        i,
        verdict
          ? { status: "done", verdict, source: p1.source, ms }
          : { status: "error", error: "The model's answer was not a valid verdict.", ms },
      );
    } catch (e) {
      if (e instanceof TriageTimeout) return patch(i, { status: "timeout", error: e.message, ms: Math.round(performance.now() - t0) });
      patch(i, { status: "error", error: String(e), ms: Math.round(performance.now() - t0) });
    }
  };

  const load = async (alerts: Alert[]) => {
    const id = ++runId.current;
    setFixture(false);
    setRows(alerts.map((alert) => ({ alert, status: "waiting" })));
    setRunning(true);
    for (const [i, a] of alerts.entries()) {
      if (runId.current !== id) return;
      await askOne(a, i);
    }
    if (runId.current === id) setRunning(false);
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

  return { rows, running, notes, setNotes, fixture, load, stop };
};

export default useTriage;
