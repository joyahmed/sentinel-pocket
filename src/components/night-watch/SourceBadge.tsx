import type { RowSource } from "@/lib/night";

type SourceBadgeProps = { source?: RowSource; ms?: number; model?: string };

const LOOK: Record<RowSource, { label: string; cls: string }> = {
  on_device: { label: "◆ ran on this device", cls: "border-device text-device" },
  in_cloud: { label: "○ ran in the cloud", cls: "border-line-strong text-ink" },
  fixture: { label: "dev fixture", cls: "border-check text-check" },
};

const SourceBadge = ({ source, ms, model }: SourceBadgeProps) => {
  if (!source) return null;
  const { label, cls } = LOOK[source];
  const parts = [label, model, typeof ms === "number" ? `${ms.toLocaleString("en-US")} ms` : null].filter(Boolean);
  return (
    <span className={`inline-flex items-center gap-2 rounded border px-2.5 py-1 font-mono text-[11px] ${cls}`}>
      {parts.join(" · ")}
    </span>
  );
};

export default SourceBadge;
