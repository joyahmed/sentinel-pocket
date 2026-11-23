"use client";

// Is Chrome's on-device model (Gemini Nano, Prompt API) usable here? The hybrid
// triage model prefers it, and reaches the cloud only within a small daily budget;
// this hook lets the UI say plainly which the owner should expect.
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
