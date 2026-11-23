import type { NightCounts } from "@/lib/night";
import type { Notice } from "@/lib/status";
import { TEXT } from "@/components/night-watch/tones";

type HeadlineProps = { counts: NightCounts; running: boolean; notice: Notice };

const Headline = ({ counts, running, notice }: HeadlineProps) => {
  const need = counts.danger + counts.check;
  const needTone = counts.danger ? "text-danger" : counts.check ? "text-check" : "text-ink";
  const facts = [
    `${counts.danger} danger`,
    `${counts.check} to check`,
    counts.sorted ? `${counts.onDevice} of ${counts.sorted} sorted on this device` : null,
    counts.byRule ? `${counts.byRule} flagged by rule (no AI answered)` : null,
    counts.avgMs !== null ? `${counts.avgMs.toLocaleString("en-US")} ms per alert` : null,
    counts.failed ? `${counts.failed} could not be sorted` : null,
  ].filter(Boolean);
  // Never say "go back to sleep" while alerts are still unread.
  const rest = counts.failed ? ` ${counts.failed} not sorted - read them.` : " Go back to sleep.";

  return (
    <div>
      {counts.total === 0 ? (
        <h1 className="font-mono text-[30px] leading-[1.08] font-light tracking-[-0.04em] lg:text-[54px]">
          Load a night of alerts.
        </h1>
      ) : (
        <h1 className="font-mono text-[30px] leading-[1.08] font-light tracking-[-0.04em] lg:text-[54px]">
          <b className={`font-extrabold ${needTone}`}>{need}</b> need you{running ? " so far" : ""}.{" "}
          <br />
          {counts.noise} are noise.{running ? "" : rest}
        </h1>
      )}
      <p className="mt-3 max-w-[70ch] text-[15px] text-muted">
        {counts.total === 0
          ? "Pick a night below or paste your own. Each alert is read by the AI in this Chrome; spikes are the ones worth waking for."
          : running
            ? `Sorting ${Math.min(counts.sorted + counts.failed + 1, counts.total)} of ${counts.total} · ${facts.join(" · ")}`
            : facts.join(" · ")}
      </p>
      {notice && <p className={`mt-3 max-w-[70ch] font-mono text-[12px] leading-relaxed ${TEXT[notice.tone]}`}>{notice.text}</p>}
    </div>
  );
};

export default Headline;
