"use client";

// Home screen state: the triage run, which alert is open in the detail panel,
// and everything derived from the verdicts (counts, list order, trace).
import { useState } from "react";
import useTriage from "@/hooks/use-triage";
import useOnline from "@/hooks/use-online";
import useOnDevice from "@/hooks/use-on-device";
import { countNight, orderForList, traceOf } from "@/lib/night";

const useNightWatch = () => {
  const triage = useTriage();
  const online = useOnline();
  const onDevice = useOnDevice();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const list = orderForList(triage.rows);
  const selected = list.find((r) => r.alert.id === selectedId) ?? list[0] ?? null;
  const counts = countNight(triage.rows);
  const trace = traceOf(triage.rows);
  const unsorted = triage.rows.filter((r) => r.status === "unsorted").length;
  // Offer more cloud (on a click) only when this device is not answering.
  const offerCloud = !triage.running && online && triage.deviceHealth !== "ok";

  const select = (id: string) => {
    setSelectedId(id);
    // On a phone the detail sits under the list; bring it into view.
    if (window.matchMedia("(max-width: 1023px)").matches) {
      document.getElementById("alert-detail")?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  const load: typeof triage.load = (alerts) => {
    setSelectedId(null);
    return triage.load(alerts);
  };

  return { ...triage, load, online, onDevice, list, selected, counts, trace, select, unsorted, offerCloud };
};

export default useNightWatch;
