import type { TriageRow } from "@/lib/night";
import useInvestigate from "@/hooks/use-investigate";
import SourceBadge from "@/components/night-watch/SourceBadge";
import { CLOUD_SLOW_TEXT, sendStateText } from "@/lib/triage";
import { renderMarkdown } from "@/lib/markdown";

type InvestigatePanelProps = { row: TriageRow; rows: TriageRow[]; online: boolean };

const BTN = "inline-block rounded-md border px-4 py-2.5 font-mono text-[13px] font-semibold transition-colors";

// The "what will be sent" preview: the bundle as a diff (red = original, stays
// here; blue = scrubbed, would leave). Nothing is sent until the owner clicks;
// the line under the title says whether it has been.
const InvestigatePanel = ({ row, rows, online }: InvestigatePanelProps) => {
  const inv = useInvestigate(row, rows);
  const hot = row.verdict?.verdict === "danger";

  return (
    <div className="mt-6">
      <button
        type="button"
        onClick={inv.toggle}
        aria-expanded={inv.open}
        className={`${BTN} ${hot ? "border-danger bg-danger text-[#160403] hover:bg-danger/90" : "border-ink text-ink hover:bg-surface-2"}`}
      >
        {inv.open ? "Close preview" : "Investigate deeper →"}
      </button>

      {inv.open && inv.bundle && (
        <section aria-label="what will be sent" className="mt-6 border-t border-line pt-6">
          <h3 className="font-mono text-[22px] font-light tracking-[-0.03em] lg:text-[30px]">leaving this machine</h3>
          <p className="mt-2 text-[14px] text-muted">
            {inv.alertCount === 1 ? "This alert" : `This alert and ${inv.alertCount - 1} nearby alert${inv.alertCount === 2 ? "" : "s"} that were not noise`}.
            Names, IP addresses and secret paths are replaced before anything leaves. <b aria-live="polite" className="text-ink">{sendStateText(inv.sending, inv.sentAt, inv.error !== null)}</b>
          </p>
          <pre className="mt-4 max-h-[320px] overflow-auto rounded-md border border-line bg-surface px-3.5 py-3 font-mono text-[11px] leading-[1.9] lg:text-[12px]">
            {inv.bundle.lines.map((l, i) =>
              l.before === l.after ? (
                <span key={i} className="block whitespace-pre-wrap text-muted">{`  ${l.after}`}</span>
              ) : (
                <span key={i} className="block whitespace-pre-wrap">
                  <span className="block text-danger">{`- ${l.before}`}</span>
                  <span className="block text-device">{`+ ${l.after}`}</span>
                </span>
              ),
            )}
          </pre>
          <div className="mt-2.5 flex flex-wrap justify-between gap-2 font-mono text-[11px] text-muted">
            <span>
              {inv.bundle.lines.length} lines · {inv.bundle.replaced} values replaced ({inv.bundle.distinct} distinct) ·{" "}
              {inv.bundle.bytes.toLocaleString("en-US")} bytes
            </span>
            <span className="text-ink">→ cloud · Gemini</span>
          </div>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={inv.send}
              disabled={!online || inv.sending}
              className={`${BTN} border-ink text-ink hover:bg-surface-2 disabled:border-line disabled:text-noise-dim`}
            >
              {inv.sending ? "Sending…" : inv.answer ? "Send again" : "Send scrubbed bundle"}
            </button>
            {!online && <span className="text-[13px] text-danger">Offline: the deep look needs the cloud.</span>}
            {inv.sending && inv.slow && (
              <span role="status" className="text-[13px] text-muted">
                {CLOUD_SLOW_TEXT}
              </span>
            )}
          </div>
          {inv.error && <p className="mt-4 font-mono text-[12px] break-words text-danger">{inv.error}</p>}
          {inv.answer && (
            <div className="mt-5 rounded-md border border-line bg-surface p-4">
              <SourceBadge source={inv.answer.source ?? "in_cloud"} ms={inv.answer.ms} model="Gemini" />
              <div className="mt-3 text-[14px] leading-relaxed break-words [overflow-wrap:anywhere]">{renderMarkdown(inv.answer.text)}</div>
            </div>
          )}
        </section>
      )}
    </div>
  );
};

export default InvestigatePanel;
