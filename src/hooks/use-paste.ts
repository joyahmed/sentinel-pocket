"use client";

// The paste box: text in, parsed alerts out, handed to the triage run.
import { useState } from "react";
import { parsePasted } from "@/lib/samples";
import type { Alert } from "@/lib/triage";

const usePaste = (onAlerts: (alerts: Alert[]) => void) => {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState("");
  const parsed = parsePasted(text);

  const submit = () => {
    if (!parsed.length) return;
    onAlerts(parsed);
    setOpen(false);
  };

  return { open, toggle: () => setOpen((o) => !o), text, setText, count: parsed.length, submit };
};

export default usePaste;
