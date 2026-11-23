import { TRACE_H, TRACE_W, clock, segmentOf, type traceOf } from "@/lib/night";
import { STROKE } from "@/components/night-watch/tones";

type HeartbeatProps = {
  trace: ReturnType<typeof traceOf>;
  count: number;
  animate: boolean;
  onPick: (id: string) => void;
};

// The signature: the night as one line. Every alert is a step in time order;
// check is a bump, danger a glowing spike you can click.
const Heartbeat = ({ trace, count, animate, onPick }: HeartbeatProps) => {
  const draw = animate ? "animate-trace" : "";
  return (
    <figure className="mt-6" aria-label="The night's alerts as one line. Spikes are danger, bumps are check.">
      <div className="relative">
        <svg viewBox={`0 0 ${TRACE_W} ${TRACE_H}`} preserveAspectRatio="none" className="block h-[96px] w-full overflow-visible lg:h-[140px]">
          <defs>
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="4" />
            </filter>
          </defs>
          <polyline
            key={`base-${trace.points}`}
            points={trace.points}
            fill="none"
            stroke={STROKE.noise}
            strokeWidth={1.5}
            vectorEffect="non-scaling-stroke"
            pathLength={1}
            strokeDasharray={1}
            className={draw}
          />
          {trace.spikes.map((s) => (
            <g key={s.id}>
              {s.level === "danger" && (
                <polyline points={segmentOf(s, count)} fill="none" stroke={STROKE.danger} strokeWidth={6} opacity={0.5} filter="url(#glow)" />
              )}
              <polyline
                points={segmentOf(s, count)}
                fill="none"
                stroke={STROKE[s.level]}
                strokeWidth={s.level === "danger" ? 2.2 : 1.8}
                vectorEffect="non-scaling-stroke"
                strokeLinejoin="round"
              />
            </g>
          ))}
        </svg>
        {trace.spikes.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onPick(s.id)}
            aria-label={`Open ${s.level} alert ${s.id}`}
            title={s.id}
            className="absolute -translate-x-1/2 -translate-y-1/2 p-2"
            style={{ left: `${(s.x / TRACE_W) * 100}%`, top: `${(s.y / TRACE_H) * 100}%` }}
          >
            <i className={`block size-2 rounded-full ${s.level === "danger" ? "animate-led bg-danger" : "bg-check"}`} />
          </button>
        ))}
      </div>
      <figcaption className="mt-1 flex justify-between font-mono text-[10px] text-noise">
        {trace.ticks.map((t, i) => (
          <span key={`${t.time}-${i}`} className={i === 0 || i === trace.ticks.length - 1 ? "" : "hidden lg:inline"}>
            {clock(t.time, trace.spansDays)}
            {i === trace.ticks.length - 1 ? " UTC" : ""}
          </span>
        ))}
      </figcaption>
    </figure>
  );
};

export default Heartbeat;
