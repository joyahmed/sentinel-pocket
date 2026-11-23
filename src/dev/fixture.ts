// DEV ONLY. Fake verdicts for screenshots, built from the dataset's own labels.
// Imported only behind NODE_ENV === "development" in use-triage; the UI shows a
// "dev fixture" pill whenever these rows are on screen.
import { SAMPLE_SETS } from "@/lib/samples";
import type { TriageRow } from "@/lib/night";

const CHECK_IDS = new Set(["real-242"]);

export const fixtureRows = (): TriageRow[] =>
  SAMPLE_SETS[0].alerts.map((alert, i) => {
    const level = CHECK_IDS.has(alert.id) ? "check" : (alert.truth ?? "check");
    return {
      alert,
      status: "done",
      source: i % 5 === 4 ? "in_cloud" : "on_device",
      verdict: {
        verdict: level,
        reason: alert.truth_reason ?? "Fixture row.",
        next_step: level === "noise" ? "Nothing to do." : "Look at what ran right before and after this alert.",
      },
    };
  });
