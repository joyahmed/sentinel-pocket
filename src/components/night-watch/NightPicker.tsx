import { SAMPLE_SETS } from "@/lib/samples";
import type { Alert } from "@/lib/triage";
import usePaste from "@/hooks/use-paste";

type NightPickerProps = {
  running: boolean;
  notes: string;
  setNotes: (v: string) => void;
  onLoad: (alerts: Alert[]) => void;
  onStop: () => void;
};

const BTN = "rounded-md border px-3 py-2 font-mono text-[12px] transition-colors";

const NightPicker = ({ running, notes, setNotes, onLoad, onStop }: NightPickerProps) => {
  const paste = usePaste(onLoad);

  return (
    <div className="mt-6">
      <div className="flex flex-wrap items-center gap-2">
        {SAMPLE_SETS.map((s) => (
          <button
            key={s.key}
            type="button"
            onClick={() => onLoad(s.alerts)}
            title={s.hint}
            className={`${BTN} border-line-strong text-ink hover:bg-surface-2`}
          >
            {s.label} <span className="text-muted">· {s.alerts.length}</span>
          </button>
        ))}
        <button
          type="button"
          onClick={paste.toggle}
          aria-expanded={paste.open}
          className={`${BTN} border-line text-muted hover:text-ink`}
        >
          {paste.open ? "close paste box" : "paste alerts"}
        </button>
        {running && (
          <button type="button" onClick={onStop} className={`${BTN} border-danger/50 text-danger hover:bg-danger/10`}>
            stop
          </button>
        )}
      </div>
      {paste.open && (
        <div className="mt-3 grid gap-3 rounded-md border border-line bg-surface p-3 lg:grid-cols-2">
          <label className="grid gap-1.5">
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">alerts</span>
            <textarea
              value={paste.text}
              onChange={(e) => paste.setText(e.target.value)}
              rows={6}
              placeholder={'One alert per line, or a JSON array of {"time", "rule", "severity", "summary"}'}
              className="w-full resize-y rounded border border-line bg-ground p-2 font-mono text-[12px] text-ink placeholder:text-noise-dim focus:border-device focus:outline-none"
            />
          </label>
          <label className="grid gap-1.5">
            <span className="font-mono text-[10px] font-semibold tracking-[0.14em] text-muted uppercase">house notes: what is normal here</span>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={6}
              className="w-full resize-y rounded border border-line bg-ground p-2 font-mono text-[12px] text-ink focus:border-device focus:outline-none"
            />
          </label>
          <div className="flex items-center gap-3 lg:col-span-2">
            <button
              type="button"
              onClick={paste.submit}
              disabled={!paste.count}
              className={`${BTN} border-ink text-ink disabled:border-line disabled:text-noise-dim`}
            >
              sort {paste.count} alert{paste.count === 1 ? "" : "s"}
            </button>
            <span className="text-[13px] text-muted">Nothing you paste leaves this machine unless you ask for a deep look.</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default NightPicker;
