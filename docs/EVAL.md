# On-device triage eval

How well Gemini Nano (Chrome Prompt API, all on this device) sorts the watchdog's
alerts into noise / check / danger, and what we changed to make it better.

## Method

- Data: `data/alerts.json`, 266 labelled alerts: 245 noise, 21 danger.
  `real-*` come from the live server; `replay-*` replay the Nov 2026 break-in.
- Runner: `/eval` page (`src/hooks/use-eval.ts`). Each alert gets a fresh clone of
  one session that holds `SYSTEM_PROMPT`; the house notes are sent with the alert.
  Output is forced to the verdict JSON schema.
- Time limit: 20 s per alert (`TRIAGE_TIMEOUT_MS`). A timeout is scored as its own
  column (`timeout`), never dropped. Session start has the same limit.
- Scoring: exact = verdict equals the label. "Danger caught" = danger labelled
  danger. "False alarm" = noise labelled danger. `check` is neither a catch nor a
  false alarm.
- Honesty split: alerts are split by the number at the end of the id.
  Even ids are the tuning half; odd ids are held out and only scored in the
  final round. The prompt and notes name no alert ids, and contain no secret
  file paths, server names or addresses.
- Caveat on the split: the baseline miss list (which spans both halves) was read
  to find the failure kinds, and many alerts come in near-identical pairs
  (for example the same SSH-key alert twice), so the odd half is not fully
  independent. The fixes are written as categories, not as copies of alerts.

## Baseline (before this change)

Gemini Nano in Chrome, ~1.5 s per alert, ~6.7 min per full run.

| Setting | Exact | Danger caught | Missed danger | False alarms (noise to danger) | Noise to check |
|---|---|---|---|---|---|
| House notes OFF | 62.0% | 19/21 | replay-08 (as noise), replay-11 (as check) | 72 | 27 |
| House notes ON | 84.2% | 12/21 | 8 as noise: real-249, real-250, real-251, real-252, replay-08, replay-10, replay-11, replay-12; real-246 as check | 22 | not recorded |

Notes-ON false alarms (22): real-003, 005, 008, 010, 012, 015, 019, 024, 076, 077,
078, 091, 105, 123, 140, 143, 144, 154, 189, 192, 195, 212.

Also seen: one alert (real-042) hung for more than 4 minutes with the GPU busy and
the page could not stop it.

## Why the house notes made Nano call danger "noise"

1. The prompt ended with "house notes describe what is normal; trust them", and
   nothing said which signs the notes can never excuse. Anything that looked a bit
   like admin work (a new SSH key, a new timer, a container, a secrets sweep, an
   outbound connection) slid to noise once notes were present.
2. The notes were broad: "admins install web apps ... creates a user, a service",
   "the watchdog restarts and saves its own files", "backup runs tar over the
   secrets folder as root". Nano matched these to attack alerts that share words
   (root, tar, secrets, service, timer).
3. The false alarms were five kinds the old prompt never described: the watchdog
   removing its own audit rules on restart (5), a too-broad miner rule firing on
   an admin `grep`/`xargs grep` that says "no IOC matched" (6), account tools
   rewriting `/etc/shadow`, `shadow+`, `gshadow+` and friends during app installs
   (9), the watchdog's own state file reported as tampering (1), and the backup
   service reading the watched secrets file (1).

## What changed

- `SYSTEM_PROMPT` (`src/lib/triage.ts`) is now three ordered steps:
  1. danger signs listed concretely, with "house notes never excuse them"
     (web app user running scripts or downloaders, secret sweeps by a web app user,
     attacker or mining-pool connections, miners on many cores, kernel-thread-named
     programs from hidden folders, uid 0 accounts, sudo for ALL, new SSH keys for
     root or a person, any `authorized_keys2`, critical new timers or cron lines,
     cron starting a container, privileged containers, the watched secrets file read by
     cat/cp/less or secrets archived by anything but the backup service,
     `ld.so.preload`);
  2. routine work listed concretely (app installs, account-file rewrites, root grep
     searches incl. the "no IOC matched" miner rule, the watchdog's own restart,
     audit rules and state files, the git version probe, the house notes);
  3. "check" only if neither fits. The "trust them" line is gone.
- `DEFAULT_NOTES` (`src/hooks/use-eval.ts`) rewritten without the schedule and
  without paths: what the backup, app installs, the backup account's key, ordinary
  timers, the watchdog restart, the CI build and admin greps look like.
- The same `SYSTEM_PROMPT` feeds the Firebase hybrid model (`src/lib/firebase.ts`),
  so the home screen gets the change too.

### Round-2 edit (the one allowed tuning change, from the even half only)

Round 1 on the even half missed 6 of 11 danger alerts; 5 of the 6 came back as
"check" on signs Step 1 already names, and one critical timer was excused by the
notes' timer line. The 2 false alarms were root greps whose search pattern held an
address. Changes, written as kinds, not copies of alerts:

- Step 1: "If any line above matches, the verdict is danger, never check, even when
  an admin might have done it." Secrets archived from a login session
  (`session-*.scope`) are not the backup.
- Step 2: an address or pool name inside a grep search pattern is the admin hunting
  for it, not a connection; the backup systemd service (a `.service` unit) archiving
  secrets is routine even when it reads the watched secrets file; the watchdog's own audit-rule
  reload and state files are always noise, not check.
- Step 3: "Check is rare."
- Notes: the timer line now reads "ordinary timers ... show up as warn alerts; a
  critical timer alert is not one of them."

## Rounds

Measured on Mac: Apple M1 Max, Google Chrome 158.0.8127.36 (macOS), Gemini Nano via
the Prompt API, `LanguageModel.availability()` = "available" (already downloaded),
smoke test "Reply with the word ok" answered "ok" in 2.1 s (session create 5.5 s).
4 full runs, 2026-11-23. Odd half scored only in the final rounds.

| Round | Notes | Alerts | Exact | Danger caught | False alarms | Noise to check | Timeouts | Avg ms |
|---|---|---|---|---|---|---|---|---|
| 1 (round-1 prompt + notes) | ON | even (tuning) | 86.5% | 5/11 | 2 | 10 | 0 | 1586 |
| 2 (round-2 edit above) | ON | even (tuning) | 94.0% | 4/11 | 0 | 1 | 0 | 1536 |
| Final (round-2) | ON | even | 94.7% | 4/11 | 0 | 0 | 0 | 1530 |
| Final (round-2) | ON | odd (held out) | 95.5% | 6/10 | 0 | 2 | 0 | 1553 |
| Final (round-2) | ON | all | 95.1% | 10/21 | 0 | 2 | 0 | 1541 |
| Final (round-2) | OFF | even | 74.4% | 10/11 | 20 | 13 | 0 | 1530 |
| Final (round-2) | OFF | odd (held out) | 76.7% | 10/10 | 22 | 9 | 0 | 1526 |
| Final (round-2) | OFF | all | 75.6% | 20/21 | 42 | 22 | 0 | 1528 |

Missed danger, final notes ON: 11 (10 called noise, 1 called check). Final notes
OFF: 1 (the critical new-timer alert, called check).

Against the Windows baseline (old prompt): notes ON went 84.2% / 12/21 / 22 false
alarms to 95.1% / 10/21 / 0; notes OFF went 62.0% / 19/21 / 72 to 75.6% / 20/21 / 42.

Reading: the goal (danger >= 20/21 with false alarms well under 22) is not met by
either setting. The prompt work removed false alarms and "check" hedging, but with
house notes in the prompt Nano still lets the notes excuse intruder signs (new SSH
keys, root tar from a login session, a critical timer, a curl to an attacker
address), even with "never excuse" and "never check" lines. Without notes it catches
20/21 but raises 42 false alarms. Round 1 vs round 2 danger (5 vs 4 of 11) is within
one alert. Next idea, not tried here (one-edit cap): keep notes out of the danger
decision, e.g. run the Step 1 check without notes and use notes only to clear
alerts that match no danger sign.

## Round 3: two passes (notes may only lower a verdict)

Asked for after the rounds above: the notes made Nano excuse intruder signs, and
without notes it raised 42 false alarms.

How it works now (`src/lib/triage.ts`, used by `/eval` and by the home screen in
`src/hooks/use-triage.ts`):

1. Pass 1: the verdict WITHOUT house notes (same `SYSTEM_PROMPT` as round 2).
2. Hard signs, checked in code on the alert text (`hardSigns`). Any hard sign makes
   the verdict "danger", and the notes cannot lower it.
3. Pass 2, only if pass 1 said "danger" or "check" and no hard sign fired: Nano gets
   the notes and is asked whether one note clearly describes this exact activity.
   The answer is limited to the pass-1 verdict or "noise" (schema enum), and code
   (`mergeVerdicts`) only accepts a move down to "noise". A failed or timed-out pass
   2 keeps the pass-1 verdict.
4. Notes: "nightly" removed (schedule hint).

Hard signs, general security knowledge only (no alert ids, hosts, addresses, paths
from this server or schedules):

- a new SSH login key for root or a person (`/root`, `/home/*`), or any `authorized_keys2`;
- a secret or watched file read, copied or archived by a non-search tool (tar, cp, cat,
  base64, curl ...) from an interactive login session (`session-*.scope`);
- a new systemd timer, service or cron line the watchdog marks critical;
- a download tool (curl, wget, nc) run by a service account, or connecting to a bare IP;
- a connection the watchdog marks as a known attacker address or a mining-pool port;
- a program run from a temp or hidden folder by a non-root account, or deleted while running;
- a known miner program or stratum URL;
- a new account with uid 0; sudo for ALL commands; `/etc/ld.so.preload` changed;
  a privileged container.

Tuned on the even half only: the first draft of the rules also fired on root's CI
build in a temp folder (it read "node_modules" as a service account); fixed to read
the account name only. After that, on the even half: 11/11 danger alerts and 0 noise
alerts show a hard sign. No prompt change in this round.

Measured on Mac (Apple M1 Max, Chrome 158.0.8127.36), 2 full runs + one 6-alert
mechanics check, 2026-11-23:

| Run | Alerts | Exact | Danger caught | False alarms | Noise to check | Timeouts | Avg ms / alert |
|---|---|---|---|---|---|---|---|
| 5: two-pass | even (tuning) | 100.0% | 11/11 | 0 | 0 | 0 | 2136 |
| 6: two-pass, final | even | 100.0% | 11/11 | 0 | 0 | 0 | 2019 |
| 6: two-pass, final | odd (held out) | 98.5% | 8/10 | 0 | 0 | 0 | 2033 |
| 6: two-pass, final | all | 99.2% | 19/21 | 0 | 0 | 0 | 2026 |
| 6: pass 1 alone (same run) | all | 76.3% | 20/21 | 45 | 17 | 0 | - |

Cost of pass 2 (run 6): it ran on 64 of 266 alerts, 2024 ms each, which adds 487 ms
per alert on average (2026 ms total versus about 1540 ms for one pass).

What the numbers say:

- False alarms went from 45 (pass 1) to 0, and no noise is left as "check".
- Pass 2 said "noise" on 64 of 64 alerts it saw, including 2 real dangers. The notes
  step does not tell "explained" from "looks a bit like admin work"; the hard signs
  are what keep danger alive. All 19 caught dangers had a hard sign.
- The 2 misses (odd half, held out) are signs `SYSTEM_PROMPT` Step 1 already names but
  the hard-sign code does not cover: a web app service account running a script from
  a hidden file in a temp folder (the program is the shell; the script is only an
  argument), and a web app service account reading many secret env files. Pass 1
  called both danger; pass 2 lowered them on the web-app-install note.
- Next step, not done here because it would be fitted to the held-out half: add those
  two generic signs (script path argument in a temp or hidden folder for a service
  account; secret sweep by a service account), then measure on fresh alerts, since
  the odd half has now been looked at.
