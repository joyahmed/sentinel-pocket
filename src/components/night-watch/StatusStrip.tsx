import Link from "next/link";
import type { Pill } from "@/lib/status";
import Led from "@/components/night-watch/Led";
import { TEXT } from "@/components/night-watch/tones";

type StatusStripProps = { pills: Pill[]; current: "/" | "/eval" };

const NAV = [
  { href: "/", label: "triage" },
  { href: "/eval", label: "eval" },
] as const;

const StatusStrip = ({ pills, current }: StatusStripProps) => (
  <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2 border-b border-line px-4 py-3 lg:px-8 lg:py-4">
    <div className="flex items-center gap-5">
      <Link href="/" className="font-mono text-[13px] font-semibold tracking-[0.04em] lg:text-sm">
        SENTINEL<span className="text-danger">●</span>POCKET
      </Link>
      <nav className="flex gap-3 font-mono text-[11px]">
        {NAV.map(({ href, label }) => (
          <Link
            key={href}
            href={href}
            aria-current={current === href ? "page" : undefined}
            className={current === href ? "text-ink underline underline-offset-4" : "text-muted hover:text-ink"}
          >
            {label}
          </Link>
        ))}
      </nav>
    </div>
    <ul className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[11px]" aria-label="status">
      {pills.map(({ key, label, tone }) => (
        <li key={key} className={`flex items-center gap-1.5 ${TEXT[tone]}`}>
          <Led tone={tone} />
          {label}
        </li>
      ))}
    </ul>
  </header>
);

export default StatusStrip;
