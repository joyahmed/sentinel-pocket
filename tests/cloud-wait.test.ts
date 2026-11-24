// The "Investigate deeper" Send waits long enough for a cold cloud start.
// Fake timers: no real waiting and no real cloud call.
import { test, mock, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import {
  CLOUD_SLOW_HINT_MS,
  CLOUD_TIMEOUT_TEXT,
  CLOUD_TIMEOUT_MS,
  TRIAGE_TIMEOUT_MS,
  TriageTimeout,
  withCloudWait,
} from "../src/lib/triage.ts";

beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
afterEach(() => mock.timers.reset());

const flush = async () => {
  for (let i = 0; i < 10; i++) await Promise.resolve();
};

// A fake cloud call that answers after `ms`.
const answerAfter = (ms: number, text: string) => () =>
  new Promise<string>((resolve) => setTimeout(() => resolve(text), ms));

test("limits: cloud waits 90 s, slow line at 10 s, on-device stays 20 s", () => {
  assert.equal(CLOUD_TIMEOUT_MS, 90_000);
  assert.equal(CLOUD_SLOW_HINT_MS, 10_000);
  assert.equal(TRIAGE_TIMEOUT_MS, 20_000);
});

test("a 27 s cloud answer is shown, after the still-thinking line", async () => {
  let slow = 0;
  let got: string | undefined;
  const p = withCloudWait(answerAfter(27_000, "attack in progress"), () => slow++).then((t) => (got = t));
  mock.timers.tick(9_999);
  await flush();
  assert.equal(slow, 0, "no slow line before 10 s");
  mock.timers.tick(1);
  await flush();
  assert.equal(slow, 1, "slow line at 10 s");
  mock.timers.tick(10_000); // 20 s: the old limit
  await flush();
  assert.equal(got, undefined, "still waiting at 20 s");
  mock.timers.tick(7_000); // 27 s
  await p;
  assert.equal(got, "attack in progress");
  assert.equal(slow, 1, "slow line only once");
});

test("a quick answer never shows the slow line", async () => {
  let slow = 0;
  const p = withCloudWait(answerAfter(3_000, "ok"), () => slow++);
  mock.timers.tick(3_000);
  assert.equal(await p, "ok");
  mock.timers.tick(90_000);
  assert.equal(slow, 0);
});

test("a hung cloud call ends with a timeout at 90 s and is aborted", async () => {
  let signal: AbortSignal | undefined;
  let settled = false;
  const p = withCloudWait(
    (s) => {
      signal = s;
      return new Promise<string>(() => {});
    },
    () => {},
  );
  p.then(
    () => (settled = true),
    () => (settled = true),
  );
  mock.timers.tick(89_999);
  await flush();
  assert.equal(settled, false, "still waiting just before 90 s");
  mock.timers.tick(1);
  await assert.rejects(p, (e: unknown) => e instanceof TriageTimeout && e.message === "no answer in 90000 ms");
  assert.equal(signal?.aborted, true);
});

test("the timeout message says 90 seconds", () => {
  assert.match(CLOUD_TIMEOUT_TEXT, /did not answer in 90 seconds/);
});

test("a 53.5 s cloud answer (seen live) is now shown, not timed out", async () => {
  const p = withCloudWait(answerAfter(53_500, "slow but here"), () => {});
  mock.timers.tick(53_500);
  assert.equal(await p, "slow but here");
});
