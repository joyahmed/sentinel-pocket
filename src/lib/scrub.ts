// Scrub a bundle of alerts before it may leave this machine: IP addresses, user
// and app names, and secret-looking paths are replaced by stable tokens (IP_1,
// USER_1, APP_1, PATH_1). The same value always gets the same token inside one
// bundle, so the cloud model can still follow the story.
import { type Alert, alertText } from "@/lib/triage";

type Kind = "IP" | "USER" | "APP" | "PATH";

export type DiffLine = { before: string; after: string };
export type ScrubbedBundle = {
  lines: DiffLine[];
  text: string;
  replaced: number;
  distinct: number;
  bytes: number;
};

const SYSTEM_ACCOUNTS = new Set(["root", "nobody", "daemon", "www-data", "unset", "N"]);
const IPV4 = /\b(?:\d{1,3}\.){3}\d{1,3}\b/g;
const ABS_PATH = /(?<![\w:/.])\/[\w.@-]+(?:\/[\w.@-]+)*/g;
const SECRET_PATH = /secret|\.env\b|\/etc\/app\b/i;
const NAME_PATTERNS = [
  /\bnew user ([\w.-]+)/g,
  /\bfor ([\w.-]+) in \//g,
  /\/home\/([\w.-]+)/g,
  /\buser ([\w.-]+)/g,
  /\b(app-[a-z0-9]+)/g,
];
const APP_PATTERN = /\b(site\d+)\b/g;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const collectNames = (alerts: Alert[], text: string) => {
  const users = new Set<string>();
  const apps = new Set<string>();
  alerts.forEach((a) => {
    if (a.context?.user) users.add(a.context.user);
    if (a.context?.app) apps.add(a.context.app);
  });
  NAME_PATTERNS.forEach((re) => [...text.matchAll(re)].forEach((m) => users.add(m[1])));
  [...text.matchAll(APP_PATTERN)].forEach((m) => apps.add(m[1]));
  SYSTEM_ACCOUNTS.forEach((s) => users.delete(s));
  return { users: [...users], apps: [...apps] };
};

export const scrubBundle = (alerts: Alert[]): ScrubbedBundle => {
  const original = alerts.map((a) => alertText(a, "")).join("\n---\n");
  const tokens = new Map<string, string>();
  const counters: Record<Kind, number> = { IP: 0, USER: 0, APP: 0, PATH: 0 };
  let replaced = 0;
  const token = (kind: Kind, value: string) => {
    const key = `${kind}:${value}`;
    if (!tokens.has(key)) tokens.set(key, `${kind}_${++counters[kind]}`);
    replaced += 1;
    return tokens.get(key)!;
  };

  const { users, apps } = collectNames(alerts, original);
  // Longest names first, so app-svc22 is not eaten by app-svc2.
  const names = [
    ...users.map((v) => ({ kind: "USER" as const, v })),
    ...apps.map((v) => ({ kind: "APP" as const, v })),
  ].sort((a, b) => b.v.length - a.v.length);

  const scrubLine = (line: string) => {
    let out = line.replace(ABS_PATH, (p) => (SECRET_PATH.test(p) ? token("PATH", p) : p));
    out = out.replace(IPV4, (ip) => token("IP", ip));
    names.forEach(({ kind, v }) => {
      out = out.replace(new RegExp(`(?<![A-Za-z0-9])${escape(v)}(?![A-Za-z0-9])`, "g"), () => token(kind, v));
    });
    return out;
  };

  const lines = original.split("\n").map((before) => ({ before, after: scrubLine(before) }));
  const text = lines.map((l) => l.after).join("\n");
  return { lines, text, replaced, distinct: tokens.size, bytes: new TextEncoder().encode(text).length };
};
