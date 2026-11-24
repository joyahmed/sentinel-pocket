// The preview's send line must not read as success after a failed cloud send.
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  CLOUD_BUSY_TEXT,
  CLOUD_FAILED_TEXT,
  CLOUD_GENERIC_ERROR_TEXT,
  cloudErrorText,
  sendStateText,
} from "../src/lib/triage.ts";

const at = new Date(2026, 10, 24, 18, 15);

test("a real answer says Sent at HH:MM", () => {
  assert.equal(sendStateText(false, at, false), "Sent at 18:15.");
});

test("a failed send says it was not answered, never Sent at", () => {
  const t = sendStateText(false, at, true);
  assert.equal(t, CLOUD_FAILED_TEXT);
  assert.doesNotMatch(t, /Sent at/);
  assert.match(t, /nothing was saved/);
});

test("while sending, and before any send, the old lines stay", () => {
  assert.match(sendStateText(true, at, false), /Waiting for its answer/);
  assert.equal(sendStateText(false, null), "Nothing has been sent yet.");
});

test("the live 500 'high demand' error maps to the busy message", () => {
  const live = new Error(
    "AI: Error fetching from https://x/generateContent: [500 ] This model is currently experiencing high demand. Please try again later.",
  );
  assert.equal(cloudErrorText(live), CLOUD_BUSY_TEXT);
  assert.doesNotMatch(cloudErrorText(live), /Error fetching/);
});

test("503, overloaded and UNAVAILABLE map to busy; other errors get the generic line", () => {
  assert.equal(cloudErrorText(new Error("[503 Service Unavailable]")), CLOUD_BUSY_TEXT);
  assert.equal(cloudErrorText(new Error("The model is overloaded")), CLOUD_BUSY_TEXT);
  assert.equal(cloudErrorText(new Error("status UNAVAILABLE")), CLOUD_BUSY_TEXT);
  assert.equal(cloudErrorText(new Error("[400 ] bad request")), CLOUD_GENERIC_ERROR_TEXT);
});
