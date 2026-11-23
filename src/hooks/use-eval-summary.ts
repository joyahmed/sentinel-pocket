"use client";

// Headline numbers for /eval, derived only from what useEval already returns
// (its logic and window.__eval output are untouched).
import alerts from "../../data/alerts.json";
import type useEval from "@/hooks/use-eval";

type EvalState = ReturnType<typeof useEval>;

const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "–");

const useEvalSummary = ({ matrix, avgMs, misses }: Pick<EvalState, "matrix" | "avgMs" | "misses">) => {
  const scored = matrix.reduce((s, m) => s + m.cells.reduce((t, c) => t + c.n, 0), 0);
  const correct = matrix.reduce((s, m) => s + (m.cells.find((c) => c.got === m.truth)?.n ?? 0), 0);
  const danger = matrix.find((m) => m.truth === "danger");
  const caught = danger?.cells.find((c) => c.got === "danger")?.n ?? 0;
  const dangerSeen = danger?.cells.reduce((t, c) => t + c.n, 0) ?? 0;

  const timedOut = matrix.reduce((s, m) => s + (m.cells.find((c) => c.got === "timeout")?.n ?? 0), 0);

  const stats = [
    { key: "accuracy", label: "accuracy (noise vs danger)", value: pct(correct, scored), note: scored ? `${correct} of ${scored}` : "not run yet" },
    { key: "recall", label: "danger caught", value: pct(caught, dangerSeen), note: dangerSeen ? `${caught} of ${dangerSeen} break-in alerts` : "not run yet" },
    { key: "ms", label: "average time per alert", value: scored ? `${avgMs.toLocaleString("en-US")} ms` : "–", note: scored ? "on this machine" : "not run yet" },
    { key: "timeout", label: "timed out (over 20 s)", value: String(timedOut), note: timedOut ? "alerts the model never answered" : "none so far" },
    // useEval calls Chrome's Prompt API directly, so every scored row ran here.
    { key: "device", label: "answered on this device", value: pct(scored, scored), note: scored ? "Prompt API, no cloud" : "not run yet" },
  ];

  return { scored, total: alerts.length, stats, misses };
};

export default useEvalSummary;
