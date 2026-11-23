import { clock, type TriageRow } from "@/lib/night";
import { explainError } from "@/lib/status";
import SourceBadge from "@/components/night-watch/SourceBadge";
import VerdictChip from "@/components/night-watch/VerdictChip";
import InvestigatePanel from "@/components/night-watch/InvestigatePanel";

type AlertDetailProps = { row: TriageRow | null; rows: TriageRow[]; online: boolean };

const LABEL = "mt-5 mb-1.5 font-mono text-[10px] font-semibold tracking-[0.14em] text-muted uppercase";

const TITLE: Record<Exclude<TriageRow["status"], "done">, string> = {
  waiting: "Not sorted yet.",
  sorting: "Reading this alert…",
  timeout: "The AI did not answer in 20 seconds. Skipped - the night kept going.",
  error: "This one could not be sorted.",
  unsorted: "Not sorted: no AI answered and no rule fired. Read it yourself.",
};

// In-place detail panel (not a route): what happened, the raw line, next step.
const AlertDetail = ({ row, rows, online }: AlertDetailProps) => {
  if (!row) return null;
  const { alert, verdict, status } = row;
  const raw = [
    `${clock(alert.time, true)} ${alert.summary}`,
    ...Object.entries(alert.context ?? {}).map(([k, v]) => `${k}: ${v}`),
  ];

  return (
    <section id="alert-detail" aria-label="alert detail" className="scroll-mt-4 border-t border-line px-4 py-6 lg:sticky lg:top-0 lg:max-h-screen lg:self-start lg:overflow-y-auto lg:border-t-0 lg:px-8 lg:py-7">
      <div className="flex flex-wrap items-center gap-2">
        <VerdictChip level={verdict?.verdict} status={status} />
        <SourceBadge source={row.source} ms={row.ms} />
      </div>
      <h2 className="mt-3 text-[22px] leading-tight font-bold lg:text-[26px]">
        {status === "done" && verdict ? verdict.reason : TITLE[status === "done" ? "error" : status]}
      </h2>
      <pre className="mt-4 overflow-x-auto rounded-md border border-line bg-surface px-3 py-2.5 font-mono text-[11px] leading-[1.7] whitespace-pre-wrap break-words text-[#FFB1A8] lg:text-[12px]">
        {raw.join("\n")}
      </pre>
      <p className="mt-2 font-mono text-[10px] text-muted">
        {alert.id} · rule {alert.rule} · {alert.severity}
      </p>
      {(status === "error" || status === "unsorted" || row.source === "rule") && row.error && (
        <>
          <p className={`mt-3 text-[15px] ${status === "error" ? "text-danger" : "text-check"}`}>{explainError(row.error)}</p>
          <p className="mt-1.5 font-mono text-[11px] [overflow-wrap:anywhere] text-muted">{row.error}</p>
        </>
      )}
      {verdict?.next_step && (
        <>
          <div className={LABEL}>Next step</div>
          <p className="text-[15px]">{verdict.next_step}</p>
        </>
      )}
      <InvestigatePanel key={alert.id} {...{ row, rows, online }} />
    </section>
  );
};

export default AlertDetail;
