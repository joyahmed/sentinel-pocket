// Sample nights for the home screen: honest slices of data/alerts.json (the
// scrubbed, labelled set), plus a parser for alerts the owner pastes in.
import alerts from "../../data/alerts.json";
import type { Alert } from "@/lib/triage";

const ALL = alerts as Alert[];

const byTime = (a: Alert, b: Alert) => a.time.localeCompare(b.time);

export type SampleSet = { key: string; label: string; hint: string; alerts: Alert[] };

export const SAMPLE_SETS: SampleSet[] = [
  {
    key: "last-night",
    label: "Nov 22-23",
    hint: "real alerts, last two days",
    alerts: ALL.filter((a) => a.source === "real" && a.time >= "2026-11-22").sort(byTime),
  },
  {
    key: "quiet-night",
    label: "Nov 20",
    hint: "real alerts, one day",
    alerts: ALL.filter((a) => a.source === "real" && a.time.startsWith("2026-11-20")).sort(byTime),
  },
  {
    key: "break-in",
    label: "Break-in replay",
    hint: "a staged intrusion",
    alerts: ALL.filter((a) => a.source === "replay").sort(byTime),
  },
  { key: "all", label: "Everything", hint: "the whole labelled set", alerts: [...ALL].sort(byTime) },
];

const TIME_AT_START = /^(\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(?::\d{2})?Z?)\s+(.*)$/;

const fromLine = (line: string, i: number): Alert => {
  const m = line.match(TIME_AT_START);
  const time = m ? new Date(m[1].replace(" ", "T")).toISOString() : new Date().toISOString();
  return { id: `pasted-${i + 1}`, time, rule: "pasted", severity: "unknown", summary: m ? m[2] : line };
};

const fromObject = (o: Partial<Alert>, i: number): Alert | null =>
  typeof o?.summary === "string"
    ? {
        id: o.id ?? `pasted-${i + 1}`,
        time: o.time ?? new Date().toISOString(),
        rule: o.rule ?? "pasted",
        severity: o.severity ?? "unknown",
        summary: o.summary,
        context: o.context,
      }
    : null;

// Accepts a JSON array of alerts, one JSON alert, or plain text with one alert per
// line (an ISO time at the start of a line is used as the alert's time). Labels
// (truth) are never carried over from pasted input.
export const parsePasted = (text: string): Alert[] => {
  const trimmed = text.trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("[") || trimmed.startsWith("{")) {
    try {
      const data = JSON.parse(trimmed) as Partial<Alert> | Partial<Alert>[];
      const list = Array.isArray(data) ? data : [data];
      return list.map(fromObject).filter((a): a is Alert => a !== null).sort(byTime);
    } catch {
      // not JSON - read it as lines
    }
  }
  return trimmed
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean)
    .map(fromLine)
    .sort(byTime);
};
