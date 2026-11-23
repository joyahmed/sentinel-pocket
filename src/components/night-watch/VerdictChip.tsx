import type { RowStatus, Level } from "@/lib/night";
import { CHIP } from "@/components/night-watch/tones";

type VerdictChipProps = { level?: Level; status: RowStatus };

const PENDING: Record<Exclude<RowStatus, "done">, { label: string; cls: string }> = {
  waiting: { label: "waiting", cls: "text-noise-dim" },
  sorting: { label: "sorting", cls: "text-device animate-led" },
  timeout: { label: "timed out", cls: "border border-check/40 text-check" },
  error: { label: "failed", cls: "border border-danger/40 text-danger" },
};

const VerdictChip = ({ level, status }: VerdictChipProps) => {
  const { label, cls } = status === "done" && level ? { label: level, cls: CHIP[level] } : PENDING[status === "done" ? "error" : status];
  return (
    <span className={`inline-block rounded px-[7px] py-[3px] text-center font-mono text-[10px] font-semibold tracking-[0.08em] uppercase ${cls}`}>
      {label}
    </span>
  );
};

export default VerdictChip;
