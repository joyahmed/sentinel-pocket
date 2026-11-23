"use client";

// Is Chrome's on-device model (Gemini Nano, Prompt API) usable here? The triage
// model prefers it and falls back to the cloud by itself; this hook only lets the
// UI say plainly which of the two the owner should expect.
import { useEffect, useState } from "react";
import { EN_TEXT } from "@/lib/triage";

export type OnDeviceState = "checking" | "available" | "downloadable" | "downloading" | "unavailable" | "missing";

type LanguageModelApi = { availability: (opts?: object) => Promise<string> };

const KNOWN: OnDeviceState[] = ["available", "downloadable", "downloading", "unavailable"];

const useOnDevice = () => {
  const [state, setState] = useState<OnDeviceState>("checking");

  useEffect(() => {
    const LM = (globalThis as unknown as { LanguageModel?: LanguageModelApi }).LanguageModel;
    const check = LM ? LM.availability(EN_TEXT) : Promise.resolve("missing");
    check
      .then((s) => setState(KNOWN.includes(s as OnDeviceState) ? (s as OnDeviceState) : "missing"))
      .catch(() => setState("unavailable"));
  }, []);

  return state;
};

export default useOnDevice;
