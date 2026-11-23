// Pure helpers for the night view: a triaged row, counts for the headline, the
// heartbeat trace geometry, list order and time labels. No React here.
import type { InferenceSource } from "firebase/ai";
import type { Alert, Verdict } from "@/lib/triage";

// "unsorted": no AI answered and no hard sign fired - the owner must read it.
export type RowStatus = "waiting" | "sorting" | "done" | "error" | "timeout" | "unsorted";
// "rule": no AI answered; a code hard sign alone made it danger.
export type RowSource = InferenceSource | "fixture" | "rule";

export type TriageRow = {
  alert: Alert;
  status: RowStatus;
  verdict?: Verdict;
  source?: RowSource;
  ms?: number;
  error?: string;
};

export type Level = Verdict["verdict"];

export const countNight = (rows: TriageRow[]) => {
  const done = rows.filter((r) => r.status === "done");
  const n = (v: Level) => done.filter((r) => r.verdict?.verdict === v).length;
  const onDevice = done.filter((r) => r.source === "on_device").length;
  const timed = done.filter((r) => typeof r.ms === "number" && r.source !== "rule");
  return {
    total: rows.length,
    sorted: done.length,
    failed: rows.filter((r) => r.status === "error" || r.status === "timeout" || r.status === "unsorted").length,
    danger: n("danger"),
    check: n("check"),
    noise: n("noise"),
    onDevice,
    inCloud: done.filter((r) => r.source === "in_cloud").length,
    byRule: done.filter((r) => r.source === "rule").length,
    avgMs: timed.length ? Math.round(timed.reduce((s, r) => s + (r.ms ?? 0), 0) / timed.length) : null,
  };
};

export type NightCounts = ReturnType<typeof countNight>;

const RANK: Record<Level, number> = { danger: 0, check: 1, noise: 2 };
const rank = (r: TriageRow) => (r.verdict ? RANK[r.verdict.verdict] : r.status === "error" || r.status === "timeout" || r.status === "unsorted" ? 3 : 4);

// Danger first, then check, then noise; newest first inside each group.
export const orderForList = (rows: TriageRow[]) =>
  [...rows].sort((a, b) => rank(a) - rank(b) || b.alert.time.localeCompare(a.alert.time));

// --- heartbeat --------------------------------------------------------------

export const TRACE_W = 1000;
export const TRACE_H = 120;
const BASE = 100;
const HEIGHT: Record<Level, number> = { noise: 0, check: 30, danger: 86 };

export type Spike = { id: string; level: Level; x: number; y: number };

// Alerts sit at even steps in time order. Noise stays on the flat line, check
// is a small bump, danger a tall spike. Returns the flat line, the spikes and
// the label ticks.
export const traceOf = (rows: TriageRow[]) => {
  const ordered = [...rows].sort((a, b) => a.alert.time.localeCompare(b.alert.time));
  const n = ordered.length;
  const step = n ? TRACE_W / n : TRACE_W;
  const half = Math.min(step * 0.45, 9);
  const points: string[] = [`0,${BASE}`];
  const spikes: Spike[] = [];
  ordered.forEach((r, i) => {
    const x = step * (i + 0.5);
    const level = r.verdict?.verdict;
    if (!level || level === "noise") return;
    const y = BASE - HEIGHT[level];
    points.push(`${(x - half).toFixed(1)},${BASE}`, `${x.toFixed(1)},${y}`, `${(x + half).toFixed(1)},${BASE}`);
    spikes.push({ id: r.alert.id, level, x, y });
  });
  points.push(`${TRACE_W},${BASE}`);
  const tickIdx = n ? [...new Set([0, Math.floor(n / 3), Math.floor((2 * n) / 3), n - 1])] : [];
  const ticks = tickIdx.map((i) => ({ x: step * (i + 0.5), time: ordered[i].alert.time }));
  return { points: points.join(" "), spikes, ticks, spansDays: spansDays(ordered.map((r) => r.alert)) };
};

export const segmentOf = (s: Spike, rowsCount: number) => {
  const step = rowsCount ? TRACE_W / rowsCount : TRACE_W;
  const half = Math.min(step * 0.45, 9);
  return `${(s.x - half).toFixed(1)},${BASE} ${s.x.toFixed(1)},${s.y} ${(s.x + half).toFixed(1)},${BASE}`;
};

// --- time -------------------------------------------------------------------

export const spansDays = (alerts: Alert[]) =>
  new Set(alerts.map((a) => a.time.slice(0, 10))).size > 1;

// Alerts carry UTC times; show them as UTC so they match the server's logs.
export const clock = (iso: string, withDate = false) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const hm = d.toISOString().slice(11, 16);
  return withDate ? `${d.toISOString().slice(5, 10)} ${hm}` : hm;
};
