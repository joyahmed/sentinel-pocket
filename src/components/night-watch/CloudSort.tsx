import type { CloudNote } from "@/hooks/use-triage";
import { CLOUD_SORT_MAX } from "@/lib/hybrid";

type CloudSortProps = { unsorted: number; offer: boolean; note: CloudNote; onSort: () => void };

const BTN = "rounded-md border px-3 py-2 font-mono text-[12px] transition-colors";

const labelFor = (unsorted: number) => {
  const n = Math.min(unsorted, CLOUD_SORT_MAX);
  return unsorted > n
    ? `Ask the cloud to sort ${n} of the ${unsorted} unsorted alerts`
    : `Ask the cloud to sort the ${n} unsorted ${n === 1 ? "alert" : "alerts"}`;
};

// Past the automatic daily budget, the only way triage reaches the cloud: an
// explicit click, at most CLOUD_SORT_MAX alerts, with the shared free-tier
// limit said up front.
const CloudSort = ({ unsorted, offer, note, onSort }: CloudSortProps) => (
  <>
    {offer && unsorted > 0 && !note?.spent && (
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <button type="button" onClick={onSort} className={`${BTN} border-line-strong text-ink hover:bg-surface-2`}>
          {labelFor(unsorted)}
        </button>
        <span className="font-mono text-[11px] text-muted">uses the free cloud quota (shared, about 20 a day)</span>
      </div>
    )}
    {note && <p className="mt-3 max-w-[70ch] font-mono text-[12px] leading-relaxed text-check">{note.text}</p>}
  </>
);

export default CloudSort;
