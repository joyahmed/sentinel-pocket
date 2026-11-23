"use client";

// Runs every labelled alert through Chrome's on-device model (the Prompt API
// directly, before Firebase is wired) and scores it. Rows also land on
// window.__eval so a script can read the result; window.__evalRun starts a run
// with explicit options and window.__evalStop stops one.
import { useEffect, useRef, useState } from "react";
import alerts from "../../data/alerts.json";
import {
  type Alert,
  EN_TEXT,
  SYSTEM_PROMPT,
  TRIAGE_TIMEOUT_MS,
  TriageTimeout,
  VERDICT_SCHEMA,
  alertText,
  hardSigns,
  mergeVerdicts,
  parseVerdict,
  secondLookSchema,
  secondLookText,
  withTimeout,
} from "@/lib/triage";

// p1/p2 = pass-1 and pass-2 answers (two-pass mode), ms2 = time pass 2 took,
// hard = hard signs found in code.
export type EvalRow = {
  id: string;
  truth: string;
  got: string;
  ms: number;
  reason: string;
  p1?: string;
  p2?: string;
  ms2?: number;
  hard?: string[];
};

// "even"/"odd" split the set by the number at the end of the alert id, so
// tuning can use one half and the other half stays held out.
export type EvalHalf = "all" | "even" | "odd";
// mode "two-pass" (default): pass 1 without notes, pass 2 with notes may only
// downgrade to noise (see mergeVerdicts). "single": one pass, notes per `notes`.
export type EvalMode = "two-pass" | "single";
// hard: false turns the code hard-sign guard off (diagnostic: what pass 2 alone does).
export type EvalRunOpts = { notes?: boolean; half?: EvalHalf; limit?: number; mode?: EvalMode; hard?: boolean };

declare global {
  interface Window {
    __eval?: {
      rows: EvalRow[];
      done: boolean;
      notes: boolean;
      half?: EvalHalf;
      mode?: EvalMode;
      stopped?: boolean;
      error?: string;
    };
    __evalRun?: (opts?: EvalRunOpts) => Promise<void>;
    __evalStop?: () => void;
  }
}

// What is normal on this server, in the owner's words. Kept generic on purpose:
// no schedules, addresses, host names or watchdog allow rules.
export const DEFAULT_NOTES = `An encrypted backup runs as its own backup systemd service and archives the secrets folder with tar as root.
Admins install web apps often: each install adds an app-* user with a nologin shell, an app-*.service, an nginx site, a deploy sudo rule for that one service, and rewrites the account files.
The backup account is a service account; it got its own SSH key when it was set up.
Ordinary timers that admins add show up as warn alerts; a critical timer alert is not one of them.
The watchdog (this alarm system) restarts during maintenance; on restart it reloads its own audit rules and saves its own state files, which it may report as tampering.
Root runs a CI test build (Node and Prisma tools) from a temporary CI test folder.
Admins search config and secret files with grep when they investigate.`;

type LanguageModelSession = {
  clone: () => Promise<LanguageModelSession>;
  prompt: (text: string, opts?: { responseConstraint?: object; signal?: AbortSignal }) => Promise<string>;
  destroy: () => void;
};
type LanguageModelApi = {
  availability: (opts?: object) => Promise<string>;
  create: (opts: object) => Promise<LanguageModelSession>;
};

const TRUTHS = ["danger", "noise"] as const;
const GOTS = ["danger", "check", "noise", "unparsed", "timeout"] as const;

const idNumber = (id: string) => Number(/(\d+)$/.exec(id)?.[1] ?? NaN);
export const inHalf = (id: string, half: EvalHalf) =>
  half === "all" || (half === "even" ? idNumber(id) % 2 === 0 : idNumber(id) % 2 === 1);

// Starting a session can also hang (seen when another session holds the GPU),
// so it gets the same time limit and honours Stop.
const createBase = (LM: LanguageModelApi, stop: AbortSignal) =>
  withTimeout(
    (signal) => LM.create({ initialPrompts: [{ role: "system", content: SYSTEM_PROMPT }], ...EN_TEXT, signal }),
    TRIAGE_TIMEOUT_MS,
    stop,
  );

const useEval = () => {
  const [rows, setRows] = useState<EvalRow[]>([]);
  const [status, setStatus] = useState("idle");
  const [useNotes, setUseNotes] = useState(true);
  const [limit, setLimit] = useState(0);
  const [half, setHalf] = useState<EvalHalf>("all");
  const [running, setRunning] = useState(false);
  const stopRef = useRef<AbortController | null>(null);

  // One alert, one fresh clone of the base session, at most TRIAGE_TIMEOUT_MS.
  // A timeout is a scored row ("timeout"), never a silent drop.
  const askPass = async (
    base: LanguageModelSession,
    text: string,
    schema: object,
    stop: AbortSignal,
  ): Promise<{ got: string; reason: string }> => {
    let s: LanguageModelSession | null = null;
    try {
      const out = await withTimeout(
        async (signal) => {
          s = await base.clone();
          return s.prompt(text, { responseConstraint: schema, signal });
        },
        TRIAGE_TIMEOUT_MS,
        stop,
      );
      const v = parseVerdict(out);
      return { got: v?.verdict ?? "unparsed", reason: v?.reason ?? "" };
    } catch (e) {
      if (e instanceof TriageTimeout) return { got: "timeout", reason: e.message };
      if (stop.aborted) throw e; // the run was stopped; this alert is not scored
      return { got: "check", reason: `error: ${String(e)}` };
    } finally {
      try {
        (s as LanguageModelSession | null)?.destroy();
      } catch {
        // already gone
      }
    }
  };

  // One alert, fresh clones of the base session, each pass at most TRIAGE_TIMEOUT_MS.
  // A pass-1 timeout is a scored row ("timeout"), never a silent drop; a pass-2
  // timeout keeps the pass-1 verdict.
  const askOne = async (
    base: LanguageModelSession,
    a: Alert,
    notes: boolean,
    mode: EvalMode,
    useHard: boolean,
    stop: AbortSignal,
  ): Promise<EvalRow> => {
    const t0 = performance.now();
    const row = (got: string, reason: string, extra: Partial<EvalRow> = {}): EvalRow => ({
      id: a.id,
      truth: a.truth ?? "?",
      got,
      ms: Math.round(performance.now() - t0),
      reason,
      ...extra,
    });
    if (mode === "single") {
      const r = await askPass(base, alertText(a, notes ? DEFAULT_NOTES : ""), VERDICT_SCHEMA, stop);
      return row(r.got, r.reason);
    }
    const hard = useHard ? hardSigns(a) : [];
    const p1 = await askPass(base, alertText(a, ""), VERDICT_SCHEMA, stop);
    if (p1.got === "timeout" || p1.got === "unparsed") return row(p1.got, p1.reason, { p1: p1.got, hard });
    const first = p1.got as "noise" | "check" | "danger";
    let p2: { got: string; reason: string } | null = null;
    let ms2: number | undefined;
    if (first !== "noise" && !hard.length && notes) {
      const t1 = performance.now();
      p2 = await askPass(base, secondLookText(a, DEFAULT_NOTES, first), secondLookSchema(first), stop);
      ms2 = Math.round(performance.now() - t1);
    }
    const second = p2?.got === "noise" ? "noise" : null;
    const got = mergeVerdicts(first, second, hard);
    const reason = hard.length ? `hard sign: ${hard.join("; ")}` : second ? p2!.reason : p1.reason;
    return row(got, reason, { p1: first, p2: p2?.got, ms2, hard });
  };

  const runWith = async (opts: EvalRunOpts = {}) => {
    if (stopRef.current) return; // one run at a time
    const notes = opts.notes ?? useNotes;
    const mode = opts.mode ?? "two-pass";
    const useHard = opts.hard ?? true;
    const which = opts.half ?? half;
    const max = opts.limit ?? limit;
    const LM = (globalThis as unknown as { LanguageModel?: LanguageModelApi }).LanguageModel;
    if (!LM) return setStatus("no LanguageModel in this browser");
    const avail = await LM.availability(EN_TEXT);
    if (avail !== "available") return setStatus(`model: ${avail}`);
    const stop = new AbortController();
    stopRef.current = stop;
    setRunning(true);
    setStatus("loading model");
    const list = (alerts as Alert[]).filter((a) => inHalf(a.id, which)).slice(0, max || undefined);
    const out: EvalRow[] = [];
    setRows([]);
    window.__eval = { rows: out, done: false, notes, half: which, mode };
    let base: LanguageModelSession | null = null;
    let failed = "";
    try {
      base = await createBase(LM, stop.signal);
      for (const a of list) {
        if (stop.signal.aborted) break;
        let row: EvalRow;
        try {
          row = await askOne(base, a, notes, mode, useHard, stop.signal);
        } catch {
          break; // stopped mid-alert
        }
        out.push(row);
        setRows([...out]);
        setStatus(`${out.length}/${list.length}`);
        if (row.got === "timeout") {
          // The hung session may still hold the GPU queue: start a fresh one.
          try {
            base.destroy();
          } catch {
            // already gone
          }
          base = null;
          base = await createBase(LM, stop.signal);
        }
      }
    } catch (e) {
      // Only session start lands here (askOne turns prompt failures into rows).
      if (!stop.signal.aborted) failed = e instanceof TriageTimeout ? `model did not start: ${e.message}` : String(e);
    } finally {
      try {
        base?.destroy();
      } catch {
        // already gone
      }
      const stopped = stop.signal.aborted;
      window.__eval = { rows: out, done: true, notes, half: which, mode, stopped, error: failed || undefined };
      setStatus(
        failed ? `${failed} (at ${out.length}/${list.length})` : stopped ? `stopped at ${out.length}/${list.length}` : "done",
      );
      stopRef.current = null;
      setRunning(false);
    }
  };

  const run = () => runWith();
  const stop = () => stopRef.current?.abort(new DOMException("stopped by user", "AbortError"));

  useEffect(() => {
    window.__evalRun = runWith;
    window.__evalStop = stop;
  });

  const matrix = TRUTHS.map((truth) => ({
    truth,
    total: rows.filter((r) => r.truth === truth).length,
    cells: GOTS.map((got) => ({ got, n: rows.filter((r) => r.truth === truth && r.got === got).length })),
  }));
  const avgMs = rows.length ? Math.round(rows.reduce((s, r) => s + r.ms, 0) / rows.length) : 0;
  const misses = rows.filter((r) => r.truth !== r.got);

  return {
    status,
    useNotes,
    setUseNotes,
    limit,
    setLimit,
    half,
    setHalf,
    running,
    run,
    stop,
    matrix,
    avgMs,
    misses,
  };
};

export default useEval;
