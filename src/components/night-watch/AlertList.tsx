import type { TriageRow } from "@/lib/night";
import AlertRow from "@/components/night-watch/AlertRow";

type AlertListProps = { rows: TriageRow[]; selectedId?: string; withDate: boolean; onSelect: (id: string) => void };

const AlertList = ({ rows, selectedId, withDate, onSelect }: AlertListProps) => (
  <section aria-label="alerts" className="border-line lg:border-r">
    {rows.length ? (
      <ul>
        {rows.map((row) => (
          <AlertRow key={row.alert.id} {...{ row, withDate, onSelect }} selected={row.alert.id === selectedId} />
        ))}
      </ul>
    ) : (
      <p className="px-4 py-10 font-mono text-[12px] text-muted lg:px-8">No alerts loaded. The list fills in as each verdict comes back.</p>
    )}
  </section>
);

export default AlertList;
