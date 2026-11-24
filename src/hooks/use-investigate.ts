"use client";

// "Investigate deeper": build the bundle (the open alert plus nearby alerts that
// were not noise), scrub it, show it, and only on an explicit click send the
// scrubbed text to the cloud investigate model.
import { useState } from "react";
import type { InferenceSource } from "firebase/ai";
import { investigateModel } from "@/lib/firebase";
import { scrubBundle } from "@/lib/scrub";
import { isRateLimit, quotaText } from "@/lib/hybrid";
import { CLOUD_TIMEOUT_TEXT, TriageTimeout, cloudErrorText, withCloudWait } from "@/lib/triage";
import type { TriageRow } from "@/lib/night";

const WINDOW_MS = 60 * 60 * 1000;
const MAX_ALERTS = 12;

type Answer = { text: string; ms: number; source?: InferenceSource };

const relatedTo = (row: TriageRow, rows: TriageRow[]) => {
  const t = Date.parse(row.alert.time);
  const near = rows
    .filter((r) => r.alert.id !== row.alert.id && r.verdict?.verdict !== "noise")
    .filter((r) => Math.abs(Date.parse(r.alert.time) - t) <= WINDOW_MS)
    .sort((a, b) => Math.abs(Date.parse(a.alert.time) - t) - Math.abs(Date.parse(b.alert.time) - t))
    .slice(0, MAX_ALERTS - 1);
  return [row, ...near].map((r) => r.alert).sort((a, b) => a.time.localeCompare(b.time));
};

const useInvestigate = (row: TriageRow, rows: TriageRow[]) => {
  const [open, setOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [slow, setSlow] = useState(false);
  const [sentAt, setSentAt] = useState<Date | null>(null);
  const [answer, setAnswer] = useState<Answer | null>(null);
  const [error, setError] = useState<string | null>(null);

  const alerts = open ? relatedTo(row, rows) : [];
  const bundle = open ? scrubBundle(alerts) : null;

  const send = async () => {
    if (!bundle || sending) return;
    setSending(true);
    setError(null);
    setSlow(false);
    setSentAt(new Date());
    const t0 = performance.now();
    try {
      const r = await withCloudWait(() => investigateModel().generateContent(bundle.text), () => setSlow(true));
      setAnswer({ text: r.response.text(), ms: Math.round(performance.now() - t0), source: r.response.inferenceSource });
    } catch (e) {
      console.error("investigate: cloud send failed", e); // technical detail stays here
      setError(e instanceof TriageTimeout ? CLOUD_TIMEOUT_TEXT : isRateLimit(e) ? quotaText(e) : cloudErrorText(e));
    }
    setSlow(false);
    setSending(false);
  };

  return { open, toggle: () => setOpen((o) => !o), alertCount: alerts.length, bundle, send, sending, sentAt, slow, answer, error };
};

export default useInvestigate;
