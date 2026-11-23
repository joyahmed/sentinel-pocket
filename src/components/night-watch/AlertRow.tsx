import { clock, type TriageRow } from "@/lib/night";
import Led from "@/components/night-watch/Led";
import VerdictChip from "@/components/night-watch/VerdictChip";

type AlertRowProps = { row: TriageRow; selected: boolean; withDate: boolean; onSelect: (id: string) => void };

const BAR = {
  danger: "shadow-[inset_2px_0_0_var(--color-danger)]",
  check: "shadow-[inset_2px_0_0_var(--color-check)]",
  noise: "shadow-[inset_2px_0_0_var(--color-noise)]",
} as const;

const SOURCE = { on_device: "device", in_cloud: "cloud", fixture: "fixture", rule: "rule" } as const;

const AlertRow = ({ row, selected, withDate, onSelect }: AlertRowProps) => {
  const level = row.verdict?.verdict;
  const tone = row.status === "timeout" || row.status === "unsorted" ? "check" : row.status === "error" ? "danger" : (level ?? "noise");
  const dim = level === "noise" || row.status === "waiting";
  return (
    <li>
      <button
        type="button"
        onClick={() => onSelect(row.alert.id)}
        aria-pressed={selected}
        className={`grid h-11 w-full animate-row-in grid-cols-[8px_auto_minmax(0,1fr)_68px] items-center gap-3 border-b border-line px-4 text-left font-mono text-[11px] hover:bg-surface lg:h-10 lg:grid-cols-[8px_auto_minmax(0,1fr)_72px_52px] lg:px-8 lg:text-[12px] ${
          selected ? `bg-surface-2 ${BAR[tone]}` : ""
        } ${dim ? "text-noise" : "text-ink"}`}
      >
        <Led tone={tone} pulse={level === "danger"} />
        <span className="text-muted tabular-nums">
          {withDate && <span className="hidden lg:inline">{clock(row.alert.time, true).slice(0, 6)}</span>}
          {clock(row.alert.time)}
        </span>
        <span className="truncate">{row.alert.summary}</span>
        <VerdictChip level={level} status={row.status} />
        <span className={`hidden text-right text-[10px] lg:block ${row.source === "on_device" ? "text-device" : "text-muted"}`}>
          {row.source ? SOURCE[row.source] : ""}
        </span>
      </button>
    </li>
  );
};

export default AlertRow;
