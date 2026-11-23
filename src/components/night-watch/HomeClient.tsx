"use client";

import useNightWatch from "@/hooks/use-night-watch";
import { statusOf } from "@/lib/status";
import StatusStrip from "@/components/night-watch/StatusStrip";
import Headline from "@/components/night-watch/Headline";
import CloudSort from "@/components/night-watch/CloudSort";
import Heartbeat from "@/components/night-watch/Heartbeat";
import NightPicker from "@/components/night-watch/NightPicker";
import AlertList from "@/components/night-watch/AlertList";
import AlertDetail from "@/components/night-watch/AlertDetail";

const HomeClient = () => {
  const nw = useNightWatch();
  const { pills, notice } = statusOf(nw.online, nw.onDevice, nw.fixture, nw.deviceHealth);

  return (
    <>
      <StatusStrip pills={pills} current="/" />
      <main className="flex-1">
        <section className="px-4 pt-7 pb-6 lg:px-8 lg:pt-9">
          <Headline counts={nw.counts} running={nw.running} notice={notice}>
            <CloudSort unsorted={nw.unsorted} offer={nw.offerCloud} note={nw.cloudNote} onSort={nw.sortInCloud} />
          </Headline>
          <Heartbeat trace={nw.trace} count={nw.rows.length} animate={!nw.running && nw.counts.sorted > 0} onPick={nw.select} />
          <NightPicker running={nw.running} notes={nw.notes} setNotes={nw.setNotes} onLoad={nw.load} onStop={nw.stop} />
        </section>
        <div className="grid border-t border-line lg:grid-cols-[1.2fr_1fr]">
          <AlertList rows={nw.list} selectedId={nw.selected?.alert.id} withDate={nw.trace.spansDays} onSelect={nw.select} />
          <AlertDetail row={nw.selected} rows={nw.rows} online={nw.online} />
        </div>
      </main>
    </>
  );
};

export default HomeClient;
