"use client";

// /smoke: one alert through Firebase AI Logic, each route on its own, so a broken
// route shows up by name. Results also land on window.__smoke for a script.
import { useState } from "react";
import alerts from "../../data/alerts.json";
import { type Alert, alertText } from "@/lib/triage";
import { investigateModel, triageModel } from "@/lib/firebase";

type Result = { route: string; ms: number; source?: string; text: string };

declare global {
  interface Window {
    __smoke?: Result[];
  }
}

const SAMPLE = (alerts as Alert[]).find((a) => a.id === "replay-07") ?? (alerts as Alert[])[0];

const useSmoke = () => {
  const [results, setResults] = useState<Result[]>([]);

  const runOne = async (route: string, call: () => Promise<{ text: string; source?: string }>) => {
    const t0 = performance.now();
    try {
      const { text, source } = await call();
      return { route, ms: Math.round(performance.now() - t0), source, text };
    } catch (e) {
      return { route, ms: Math.round(performance.now() - t0), text: `ERROR ${String(e)}` };
    }
  };

  const run = async () => {
    const prompt = alertText(SAMPLE, "");
    const out: Result[] = [];
    out.push(
      await runOne("cloud (investigate model)", async () => {
        const r = await investigateModel().generateContent(prompt);
        return { text: r.response.text(), source: r.response.inferenceSource };
      }),
    );
    setResults([...out]);
    out.push(
      await runOne("hybrid (triage model)", async () => {
        const r = await triageModel().generateContent(prompt);
        return { text: r.response.text(), source: r.response.inferenceSource };
      }),
    );
    setResults([...out]);
    window.__smoke = out;
  };

  return { sample: SAMPLE, results, run };
};

export default useSmoke;
