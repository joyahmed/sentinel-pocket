"use client";

// /eval - score the on-device model on the labelled alert set, in the Night
// Watch look. #run and #status keep their ids: scripts drive and read them.
import useEval from "@/hooks/use-eval";
import useEvalSummary from "@/hooks/use-eval-summary";
import useOnline from "@/hooks/use-online";
import useOnDevice from "@/hooks/use-on-device";
import { statusOf } from "@/lib/status";
import StatusStrip from "@/components/night-watch/StatusStrip";

const LABEL = "font-mono text-[10px] font-semibold tracking-[0.14em] text-muted uppercase";

const HALVES = [
  { value: "all", label: "all" },
  { value: "even", label: "even ids (tuning)" },
  { value: "odd", label: "odd ids (held out)" },
] as const;

const EvalClient = () => {
  const ev = useEval();
  const { scored, total, stats, misses } = useEvalSummary(ev);
  const { pills } = statusOf(useOnline(), useOnDevice(), false);

  return (
    <>
      <StatusStrip pills={pills} current="/eval" />
      <main className="flex-1 px-4 py-7 lg:px-8 lg:py-9">
        <h1 className="font-mono text-[30px] leading-[1.08] font-light tracking-[-0.04em] lg:text-[54px]">
          eval · <b className="font-extrabold">{scored}</b> of {total} scored
        </h1>
        <p className="mt-3 max-w-[70ch] text-[15px] text-muted">
          Every alert in the scrubbed, labelled set goes through Chrome&apos;s on-device model. Nothing leaves this machine.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3 font-mono text-[12px]">
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={ev.useNotes} onChange={(e) => ev.setUseNotes(e.target.checked)} className="accent-device" />
            house notes
          </label>
          <label className="flex items-center gap-2">
            limit
            <input
              type="number"
              value={ev.limit}
              onChange={(e) => ev.setLimit(+e.target.value)}
              className="w-20 rounded border border-line bg-surface-2 px-2 py-1 text-ink focus:border-device focus:outline-none"
            />
            <span className="text-muted">(0 = all)</span>
          </label>
          <label className="flex items-center gap-2">
            alerts
            <select
              id="half"
              value={ev.half}
              onChange={(e) => ev.setHalf(e.target.value as typeof ev.half)}
              className="rounded border border-line bg-surface-2 px-2 py-1 text-ink focus:border-device focus:outline-none"
            >
              {HALVES.map(({ value, label }) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <button id="run" type="button" onClick={ev.run} disabled={ev.running} className="rounded-md border border-ink px-4 py-2 font-semibold hover:bg-surface-2 disabled:opacity-40">
            run
          </button>
          <button id="stop" type="button" onClick={ev.stop} disabled={!ev.running} className="rounded-md border border-line px-4 py-2 font-semibold text-muted hover:bg-surface-2 disabled:opacity-40">
            stop
          </button>
          <span id="status" className="text-device">
            {ev.status}
          </span>
        </div>

        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_1fr]">
          <table className="w-full border-collapse self-start font-mono text-[12px]">
            <tbody>
              {stats.map((s) => (
                <tr key={s.key} className="border-b border-line">
                  <td className="py-3 pr-4">
                    {s.label}
                    <span className="block text-[10px] text-muted">{s.note}</span>
                  </td>
                  <td className="py-3 text-right text-[28px] font-extrabold tracking-[-0.03em] lg:text-[34px]">{s.value}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div>
            <div className={LABEL}>truth vs answer</div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full border-collapse font-mono text-[12px]">
                <tbody>
                  {ev.matrix.map(({ truth, total, cells }) => (
                    <tr key={truth} className="border-b border-line">
                      <td className={`py-2.5 pr-4 ${truth === "danger" ? "text-danger" : "text-noise"}`}>
                        {truth} ({total})
                      </td>
                      {cells.map(({ got, n }) => (
                        <td key={got} className={`py-2.5 pr-3 text-right tabular-nums ${got === truth ? "text-ink" : n ? "text-check" : "text-noise-dim"}`}>
                          <span className="text-muted">{got} </span>
                          {n}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={`${LABEL} mt-10`}>misses ({misses.length})</div>
        {misses.length ? (
          <ul className="mt-2">
            {misses.map((r) => (
              <li key={r.id} className="grid gap-1 border-b border-line py-2.5 font-mono text-[11px] lg:grid-cols-[110px_190px_1fr] lg:text-[12px]">
                <span>{r.id}</span>
                <span className="text-muted">
                  truth <span className={r.truth === "danger" ? "text-danger" : "text-noise"}>{r.truth}</span> · got{" "}
                  <span className="text-check">{r.got}</span>
                </span>
                <span className="font-sans text-[14px] text-ink">{r.reason}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-2 font-mono text-[12px] text-muted">{scored ? "None." : "Run the eval to see which alerts it gets wrong."}</p>
        )}
      </main>
    </>
  );
};

export default EvalClient;
