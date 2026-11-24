// The triage contract: one alert in, one verdict out. The same instructions and
// answer shape are used on-device and in the cloud, so the two can be compared.

export type Alert = {
  id: string;
  source?: string;
  time: string;
  rule: string;
  severity: string;
  summary: string;
  context?: Record<string, string>;
  truth?: "noise" | "danger";
  truth_reason?: string;
};

export type Verdict = {
  verdict: "noise" | "check" | "danger";
  reason: string;
  next_step: string;
};

export const VERDICT_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["noise", "check", "danger"] },
    reason: { type: "string" },
    next_step: { type: "string" },
  },
  required: ["verdict", "reason", "next_step"],
} as const;

export const SYSTEM_PROMPT = `You triage security alerts from a Linux web server for its owner.
Answer with JSON: verdict, reason, next_step.

Step 1 - "danger" if the alert shows any of these intruder signs. House notes never excuse them:
- a web app user (app-*) running a script or program from /tmp, /dev/shm or a hidden folder, or running a downloader such as wget or curl;
- a web app user reading many secret env files; any connection to a known attacker address or a mining-pool port;
- a crypto miner using many CPU cores;
- a program named like a kernel thread, run from a hidden folder or deleted from disk while running;
- a new account with uid 0; passwordless sudo for ALL commands;
- a new SSH login key for root or for a person's account; any authorized_keys2 file created or changed;
- a new systemd timer or cron line marked critical; a cron line that starts a container; a privileged container from an unknown image;
- the watched secrets file read by cat, cp, less or similar, or secret files packed into an archive, by anything other than the backup service (an archive made from a login session, unit session-*.scope, is not the backup);
- /etc/ld.so.preload created or changed.
If any line above matches, the verdict is "danger", never "check", even when an admin might have done it: danger means "verify this now".

Step 2 - "noise" if it is routine work:
- app installs: new app-* users with a nologin shell, app-*.service files, nginx sites, deploy sudo rules limited to one systemctl command;
- account tools rewriting /etc/passwd, shadow, group, gshadow and their +, -, .lock or numbered temp copies;
- root searching files with grep or xargs grep, even when it touches secret files or the watched secrets file or trips a miner rule that says no IOC matched; an address or pool name inside the grep search pattern is the admin hunting for it, not a connection;
- the backup systemd service (a .service unit, not a login session) archiving secrets with tar, even when it reads the watched secrets file;
- the watchdog stopping, restarting, reloading its own audit rules (audit rules changed by auditctl) or saving its own state files: always "noise", not "check";
- a web app asking git for its version at startup;
- anything the house notes describe as normal.

Step 3 - "check" only if neither step fits. Check is rare.
reason: one plain sentence, at most 25 words. next_step: one short instruction.`;

// Chrome's Prompt API warns in the console when a session has no language.
// Every on-device session is created with English text in and out.
export const EN_TEXT = {
  expectedInputs: [{ type: "text" as const, languages: ["en"] }],
  expectedOutputs: [{ type: "text" as const, languages: ["en"] }],
};

// One on-device answer must not hold the page forever: Gemini Nano has been seen
// to hang for minutes on a single alert. Every prompt call gets this budget.
export const TRIAGE_TIMEOUT_MS = 20_000;

export class TriageTimeout extends Error {
  constructor(ms: number) {
    super(`no answer in ${ms} ms`);
    this.name = "TriageTimeout";
  }
}

// Runs one model call with an abort signal and a time limit. On timeout the
// signal is aborted (the Prompt API takes `signal`) and the promise rejects with
// TriageTimeout even if the call ignores the signal. `outer` lets a caller
// cancel too (a Stop button). Use it around any triage call, on-device or cloud.
export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  ms: number = TRIAGE_TIMEOUT_MS,
  outer?: AbortSignal,
): Promise<T> {
  const ctl = new AbortController();
  const onOuter = () => ctl.abort(outer?.reason);
  if (outer?.aborted) onOuter();
  else outer?.addEventListener("abort", onOuter, { once: true });
  let timer: ReturnType<typeof setTimeout> | undefined;
  const limit = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const e = new TriageTimeout(ms);
      ctl.abort(e);
      reject(e);
    }, ms);
  });
  const cancelled = new Promise<never>((_, reject) => {
    if (ctl.signal.aborted) reject(ctl.signal.reason);
    ctl.signal.addEventListener("abort", () => reject(ctl.signal.reason), { once: true });
  });
  const call = run(ctl.signal);
  call.catch(() => {}); // a late rejection after we gave up is not an error
  try {
    return await Promise.race([call, limit, cancelled]);
  } finally {
    clearTimeout(timer);
    outer?.removeEventListener("abort", onOuter);
  }
}

// A cloud call the owner asked for ("Investigate deeper" -> Send) gets longer:
// the first cloud answer of a while has been measured at ~27 s (HTTP 200 after
// the old 20 s limit had already given up), likely a cold start, and later at
// 53.5 s, too close to a 60 s limit. The on-device budget (TRIAGE_TIMEOUT_MS) is
// unchanged.
export const CLOUD_TIMEOUT_MS = 90_000;
// Past this, the page says the wait is normal instead of looking frozen.
export const CLOUD_SLOW_HINT_MS = 10_000;
export const CLOUD_SLOW_TEXT = "Still thinking — the first cloud answer can take over a minute.";
export const CLOUD_TIMEOUT_TEXT = "The cloud AI did not answer in 90 seconds. Try again in a minute.";

// The preview's send line: before, during and after a Send.
export const sendStateText = (sending: boolean, sentAt: Date | null): string => {
  if (sending) return "Sent to the cloud AI. Waiting for its answer…";
  if (!sentAt) return "Nothing has been sent yet.";
  const hh = String(sentAt.getHours()).padStart(2, "0");
  const mm = String(sentAt.getMinutes()).padStart(2, "0");
  return `Sent at ${hh}:${mm}.`;
};

// withTimeout with the cloud budget, plus `onSlow` called once if no answer
// came within CLOUD_SLOW_HINT_MS. Never called when the answer is quick.
export async function withCloudWait<T>(
  run: (signal: AbortSignal) => Promise<T>,
  onSlow: () => void,
  outer?: AbortSignal,
): Promise<T> {
  const hint = setTimeout(onSlow, CLOUD_SLOW_HINT_MS);
  try {
    return await withTimeout(run, CLOUD_TIMEOUT_MS, outer);
  } finally {
    clearTimeout(hint);
  }
}

export function alertText(a: Alert, houseNotes: string): string {
  const ctx = a.context
    ? Object.entries(a.context)
        .map(([k, v]) => `${k}: ${v}`)
        .join("\n")
    : "";
  return [
    houseNotes ? `House notes:\n${houseNotes}` : "",
    `Alert (${a.severity}, rule ${a.rule}, ${a.time}):`,
    a.summary,
    ctx,
  ]
    .filter(Boolean)
    .join("\n");
}

export function parseVerdict(text: string): Verdict | null {
  try {
    const v = JSON.parse(text) as Verdict;
    if (["noise", "check", "danger"].includes(v.verdict)) return v;
  } catch {
    // fall through
  }
  return null;
}

// ---- Two-pass triage -------------------------------------------------------
// Pass 1 judges the alert WITHOUT house notes (notes made Nano excuse intruder
// signs). Only a pass-1 "danger" or "check" gets pass 2, which shows the notes
// and may only lower the verdict to "noise". Hard signs are checked in code and
// block that downgrade; they also lift a pass-1 "check" or "noise" to "danger".
// They are general intruder signs, not facts about one server.

const alertBlob = (a: Alert) =>
  [a.summary, ...Object.values(a.context ?? {})].join("\n");

const exeName = (a: Alert) => (a.context?.exe ?? "").split("/").pop() ?? "";
const fromLoginSession = (a: Alert) => /^session-\d+\.scope$/.test(a.context?.unit ?? "");
// The account behind an alert: the context user, else "(program, account)" or
// "user X" in the summary.
const account = (a: Alert) =>
  a.context?.user || /\([\w.-]+, ([\w-]+)\)/.exec(a.summary)?.[1] || /\buser (\S+)/.exec(a.summary)?.[1] || "";

const HARD_SIGNS: { name: string; test: (a: Alert, text: string) => boolean }[] = [
  {
    name: "new SSH login key for root or a person (/root or /home), or any authorized_keys2",
    test: (_a, t) => /authorized_keys2/.test(t) || /\/(root|home\/[^/\s]+)\/\.ssh\/authorized_keys/.test(t),
  },
  {
    name: "secret or watched file read, copied or archived by a non-search tool from an interactive login session",
    test: (a, t) =>
      fromLoginSession(a) &&
      /secret|env sweep|\.env\b/i.test(t) &&
      /^(tar|zip|7z|gzip|bzip2|xz|cp|cat|less|more|head|tail|base64|scp|rsync|curl|wget|nc|dd|coreutils)$/.test(exeName(a)),
  },
  {
    name: "new systemd timer, service or cron line the watchdog marks critical",
    test: (a, t) => a.severity === "critical" && /new (systemd (timer|service)|cron)/i.test(t),
  },
  {
    name: "download tool (curl, wget, nc) run by a service account, or connecting to a bare IP address",
    test: (a, t) =>
      /\b(curl|wget|nc|ncat)\b/.test(exeName(a) + " " + a.summary) &&
      (/\b\d{1,3}(\.\d{1,3}){3}\b/.test(a.summary) || /ran (curl|wget|nc)\b/.test(t)),
  },
  {
    name: "connection the watchdog marks as a known attacker address or a mining-pool port",
    test: (_a, t) => /known attacker address|mining pool/i.test(t),
  },
  {
    name: "program run from a temp or hidden folder by a non-root account, or deleted while running",
    test: (a) => {
      const exe = a.context?.exe ?? "";
      const who = account(a);
      const odd = /^\/(tmp|dev\/shm|var\/tmp)\//.test(exe) || /\/\.[^/]+\//.test(exe);
      return (odd && who !== "" && who !== "root") || /\(deleted\)/.test(exe);
    },
  },
  { name: "known miner program or stratum URL", test: (_a, t) => /xmrig|stratum\+tcp|minerd|cpuminer/i.test(t) },
  { name: "new account with uid 0", test: (_a, t) => /new user [^\n]*\(uid 0[,)]/i.test(t) },
  { name: "sudo for ALL commands", test: (_a, t) => /NOPASSWD:\s*ALL\b|ALL=\(ALL(:ALL)?\)\s+ALL\b/.test(t) },
  { name: "/etc/ld.so.preload created or changed", test: (_a, t) => /ld\.so\.preload/.test(t) },
  { name: "privileged container", test: (_a, t) => /privileged=true|--privileged/.test(t) },
];

// Names of the hard signs this alert shows (empty = none).
export function hardSigns(a: Alert): string[] {
  const text = alertBlob(a);
  return HARD_SIGNS.filter((s) => s.test(a, text)).map((s) => s.name);
}

// Pass 2: the only answers allowed are the pass-1 verdict or "noise".
export const secondLookSchema = (first: Verdict["verdict"]) => ({
  ...VERDICT_SCHEMA,
  properties: { ...VERDICT_SCHEMA.properties, verdict: { type: "string", enum: [first, "noise"] } },
});

export function secondLookText(a: Alert, houseNotes: string, first: Verdict["verdict"]): string {
  return [
    `Second look. Without house notes this alert was judged "${first}".`,
    `House notes (what is normal on this server):\n${houseNotes}`,
    alertText(a, ""),
    `Does one house note clearly describe this exact activity: the same kind of program, the same account or service, the same action? ` +
      `If yes, answer "noise" and say which note in reason. If no note fits exactly, or it only fits loosely, answer "${first}".`,
  ].join("\n\n");
}

// The final verdict from both passes. `second` is null when pass 2 did not run.
export function mergeVerdicts(
  first: Verdict["verdict"],
  second: Verdict["verdict"] | null,
  hard: string[],
): Verdict["verdict"] {
  if (hard.length) return "danger";
  if (first === "noise") return "noise";
  return second === "noise" ? "noise" : first;
}
