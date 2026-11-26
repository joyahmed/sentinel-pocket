# Devpost submission: Sentinel Pocket

Draft text for the #BuildHybridAI 2026 submission form. Copy each field into Devpost as is.
Fill in `VIDEO_URL` after the video is on YouTube (public).

## Form fields

| Field | Value |
|---|---|
| Project name | Sentinel Pocket |
| Tagline | The AI in your own Chrome sorts server security alerts into noise, check or danger. Your logs stay on your machine; the cloud only ever sees a scrubbed copy. |
| Platform | Web (Chrome): Gemini Nano via Firebase AI Logic |
| Try it out (live) | https://sentinel-pocket.web.app |
| Code (public, Apache-2.0) | https://github.com/joyahmed/sentinel-pocket |
| Video (YouTube, public, 3:00 max) | https://youtu.be/bxhhcbc0pzo |
| New or existing app | New project, built for this hackathon. |

Tagline length: 164 characters (limit 200).

### Testing instructions (for judges)

1. Open https://sentinel-pocket.web.app in desktop Chrome with the built-in AI (Gemini Nano) turned on.
   No login is needed.
2. The status strip at the top says whether the on-device model is ready and whether you are online.
3. Click a sample night (for example "Nov 22-23 · 18"). Each alert gets a verdict, a one-line reason and
   a next step. The badge on each answer says "ran on this device" or "ran in the cloud".
4. Turn Wi-Fi off and load another night: sorting keeps working on the device.
5. Open a danger alert and press "Investigate deeper". Read the preview of what would leave the machine
   (IPs, names, apps and paths swapped for tokens), then press "Send scrubbed bundle".
6. Open `/eval` to run all 266 labelled alerts on your own machine (about 9 minutes).

Triage is hybrid (`PREFER_ON_DEVICE`): Gemini Nano when Chrome has it, the cloud when it does not,
with a cloud budget of 3 answers per browser per day (scrubbed text only). Past the budget, or if
Nano says "available" but does not answer, the built-in rules are the floor: they flag the clear
intruder signs ("flagged by rule"), and the rest are shown as "not sorted". More cloud only on a
click: a button offers "Ask the cloud to sort the N unsorted alerts", at most 5 per click. The
cloud side is the Firebase AI Logic free tier: about 20 requests a day, shared by every visitor.
When it is used up, all cloud calls stop and the app says so and when it resets.

## Long description

### Inspiration

I run a small production server with a watchdog on it. In ten days it raised over fifteen hundred
security alerts. Almost all of them were nothing: backups, app installs, my own admin work. But I
still had to read each one, because one of them could be a real break-in.

I wanted something to read them for me. I did not want to paste my logs into a cloud chat: they
hold IP addresses, commands, user names and secret paths. A model that lives in my own browser fixes
that. It is fast, free, works offline, and my logs never leave my laptop.

### What it does

Sentinel Pocket sorts server security alerts into three piles: **noise**, **check** or **danger**.

- Every alert gets a verdict, one plain reason (25 words at most) and one next step.
- A headline says how many alerts need me and how many I can sleep through.
- Every answer shows where it ran: "ran on this device" or "ran in the cloud", with the time it took.
- It keeps sorting with the network off, because the model lives in Chrome. At three in the
  morning, the network may be the thing under attack.
- "Investigate deeper" sends related alerts to a bigger cloud model that reads them as one story.
  Before anything leaves, I see a preview: red lines stay here, blue lines would leave, and IPs,
  user names, app names and secret paths are swapped for tokens (IP_1, USER_1, APP_1, PATH_1).
  Nothing is sent until I click.
- `/eval` runs the whole labelled set in the browser and shows the score and every miss.
- I can paste my own alerts instead of using the samples.

**Results.** I labelled 266 alerts: 252 real alerts from my server (scrubbed) and 14 replays of a
real break-in pattern. 245 are noise, 21 are danger. All answered on the device (Apple M1 Max,
Chrome 158, Gemini Nano):

| Measure | All 266 | Held-out half (odd ids) |
|---|---|---|
| Exact (verdict equals label) | 99.2% | 98.5% |
| Danger alerts caught | 19/21 | 8/10 |
| False alarms (noise called danger) | 0 | 0 |

Both passes together take about 2.5 s per alert. I tuned only on the even ids; the odd ids were held out
and scored only in the final run.

### How I built it

I built it as a Next.js and Tailwind CSS web app on Firebase Hosting. All the AI runs through
**Firebase AI Logic**, with one triage contract and one deep-look model (`src/lib/firebase.ts`):

1. **Triage, hybrid.** `getGenerativeModel` with `InferenceMode.PREFER_ON_DEVICE`. On the device,
   Gemini Nano must answer valid JSON: `promptOptions.responseConstraint` is set to `VERDICT_SCHEMA`
   (verdict, reason, next_step). In the cloud, `gemini-3.6-flash` gets the same system prompt and
   the same answer shape (`responseSchema`), so on-device and cloud answers can be compared fairly.
   `response.inferenceSource` drives the "where it ran" badge and a cloud budget: at most 3 cloud
   answers per browser per day, then the rest of the night runs on an `ONLY_ON_DEVICE` copy of the
   model plus the code rules. The warm-up probe is `ONLY_ON_DEVICE` too, so it never spends quota.
   A Nano that says "available" but hangs is not asked through the hybrid model; the rules are the
   floor. Cloud-bound triage text is scrubbed first. More cloud only when I press "Ask the cloud
   to sort" (an `ONLY_IN_CLOUD` copy, at most 5 alerts per click).
2. **Investigate, cloud only.** A second model with `InferenceMode.ONLY_IN_CLOUD`. It is called only
   after I have seen the scrubbed preview (`src/lib/scrub.ts`, `src/hooks/use-investigate.ts`).
   The cloud gets the scrubbed text, never the raw alerts.
3. **App Check with reCAPTCHA Enterprise** (`ReCaptchaEnterpriseProvider`), so only this app can
   call the models.

On top of the model I added a decision process in code (`src/lib/triage.ts`):

- **Pass 1:** Nano judges the alert on its own, without any notes about my server.
- **Hard signs:** code checks the alert for 11 general intruder signs, for example a new SSH login
  key for root, a new account with uid 0, sudo for ALL commands, a known miner, a program run from a
  temp folder by a service account, or a privileged container. A hard sign always means "danger".
  Nothing can excuse it.
- **Pass 2:** only if pass 1 said "danger" or "check" and no hard sign fired. Nano now reads my house
  notes (what is normal on this server). The answer schema allows only the pass-1 verdict or
  "noise", and code (`mergeVerdicts`) accepts only a move down to "noise".
- Every model call has a 20 s limit (`withTimeout`, `TRIAGE_TIMEOUT_MS`).

The home screen (`src/hooks/use-triage.ts`) and the eval page (`src/hooks/use-eval.ts`) use the same
rules, so the score I report is the behaviour you see.

### Challenges I ran into

- **Gemini Nano hung on Windows.** While I was building it, Nano in Chrome on Windows once hung for
  more than 4 minutes on one alert, with the GPU busy, and the page could not stop it. I wrapped
  every model call in a 20 s limit that aborts the call and moves on. A timeout is counted as its
  own result in the eval, never dropped. The final runs had 0 timeouts.
- **My house notes excused real attacks.** With the notes in the prompt, Nano matched them to attack
  alerts that shared words like root, tar, secrets or timer, and caught only 10 of 21 dangers. Without
  the notes it caught 20 of 21 but raised 45 false alarms. Prompt rewording alone did not fix it. So
  I split the job: pass 1 judges without notes, code checks hard signs that nothing can excuse, and
  pass 2 may use the notes only to lower a verdict to noise. That took it to 19/21 with 0 false
  alarms.
- **Free-tier cloud quota.** The cloud side is the Firebase AI Logic free tier: about 20 requests a
  day for the whole project, shared by every visitor. An early version sent alerts to the cloud
  automatically when Nano hung, and one 18-alert night used up the day's quota for everyone. Now
  the hybrid model has a budget of 3 cloud answers per browser per day, and more cloud is only on
  a click ("Investigate deeper", or "Ask the cloud to sort", at most 5 per click). A daily-quota
  429 stops all cloud use for the session at once, with plain words: the quota is used up for
  today, and when it resets.
- **Scrubbing real alerts.** My test data had to be real to mean anything, but real alerts hold
  addresses, user names, app names and secret paths. I scrubbed every alert before it entered the
  public repo, then re-ran the full eval on a fresh clone of the public code: no alert changed
  verdict. The same idea runs in the app: the cloud only gets a scrubbed copy, and I see it first.

### Accomplishments that I'm proud of

- 99.2% exact on 266 labelled alerts, 19 of 21 dangers caught, 0 false alarms, all on the device.
  On the half I held out: 98.5%, 8 of 10, 0 false alarms.
- The honest bits are in the repo: every tuning round, the held-out split, and both misses, written
  up in `docs/EVAL.md`.
- A real privacy line, not a promise: with Nano, the default path never leaves the machine; without
  it, at most 3 scrubbed alerts a day go to the cloud; and "Investigate deeper" shows exactly what
  will be sent before it goes.
- It works offline, which is when a security tool matters most.

### What I learned

- A small on-device model is good at one narrow judgement, and bad at weighing "this looks like
  normal admin work" against "this is an intruder sign" in the same breath. Splitting those two jobs
  helped more than any prompt edit.
- Some rules belong in code, not in a prompt. The hard signs are what keep real danger from being
  explained away: pass 2 said "noise" on all 64 alerts it saw.
- One answer shape for both routes (`responseConstraint` on the device, `responseSchema` in the cloud)
  makes hybrid inference simple: the app does not care where the answer came from, it only shows it.
- Measure with a held-out half and a time limit from day one. My first numbers looked fine until I
  counted false alarms and timeouts on their own.

### What's next

- Add the two signs behind the 2 misses to the hard-sign code (a service account running a script
  from a hidden temp folder, and a service account reading many secret settings files), then measure
  on fresh alerts.
- Label more alerts, and more danger examples, so the score means more.
- A Chrome extension that sorts alerts as they arrive, and an Android build with Gemini Nano through
  the same Firebase AI Logic code.
- Firebase Remote Config for the house notes, so I can change them without a new build.

## Built with

`firebase-ai-logic`, `gemini-nano`, `chrome-built-in-ai`, `prompt-api`, `gemini`, `firebase-app-check`,
`recaptcha-enterprise`, `firebase-hosting`, `next.js`, `react`, `typescript`, `tailwind-css`

## Judging criteria and where to find the evidence

The four criteria are weighted equally, each scored 1 to 5.

| Criterion | Evidence |
|---|---|
| **Technological Implementation**: how well it is built, and how well it uses Firebase AI Logic hybrid inference | `PREFER_ON_DEVICE` hybrid triage, `responseConstraint` on the device and a matching `responseSchema` in the cloud: [src/lib/firebase.ts#L69-L81](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/firebase.ts#L69-L81). `ONLY_ON_DEVICE` copy for the warm-up probe and for the night once the cloud budget is spent: [#L83-L89](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/firebase.ts#L83-L89). `ONLY_IN_CLOUD` copy, only on a click: [#L91-L97](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/firebase.ts#L91-L97). `ONLY_IN_CLOUD` investigate: [#L99-L113](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/firebase.ts#L99-L113). App Check with reCAPTCHA Enterprise: [#L57-L67](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/firebase.ts#L57-L67). Called at runtime with `inferenceSource`, a cloud budget of 3 per browser per day, scrubbed cloud text, rules as the floor: [src/hooks/use-triage.ts#L162-L207](https://github.com/joyahmed/sentinel-pocket/blob/main/src/hooks/use-triage.ts#L162-L207) (budget counter: [src/lib/hybrid.ts](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/hybrid.ts)); more cloud only on a click: [#L283-L318](https://github.com/joyahmed/sentinel-pocket/blob/main/src/hooks/use-triage.ts#L283-L318). Hard signs and merge rule: [src/lib/triage.ts#L148-L221](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/triage.ts#L148-L221). 20 s limit: [#L59-L103](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/triage.ts#L59-L103). |
| **Design**: a complete, coherent product, not a proof of concept | One flow from load to verdict to deep look: headline, sorted list (danger first), detail panel, "where it ran" badge ([src/components/night-watch/SourceBadge.tsx](https://github.com/joyahmed/sentinel-pocket/blob/main/src/components/night-watch/SourceBadge.tsx)), online and on-device status strip, offline notice, plain-words errors including the 429 case ([src/lib/status.ts#L74-L94](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/status.ts#L74-L94)), the scrubbed preview before sending ([src/components/night-watch/InvestigatePanel.tsx](https://github.com/joyahmed/sentinel-pocket/blob/main/src/components/night-watch/InvestigatePanel.tsx)). Three design directions explored first: [docs/design/DESIGN.md](https://github.com/joyahmed/sentinel-pocket/blob/main/docs/design/DESIGN.md). Hosted: https://sentinel-pocket.web.app |
| **Potential Impact**: a credible, specific case for a real problem and a real audience | The problem is mine: over fifteen hundred alerts in ten days on one small server, and logs I will not paste into a cloud chat. The audience: people who run their own servers without a security team. Measured on 266 labelled alerts from that server: 99.2% exact, 19/21 dangers, 0 false alarms; held out: 98.5%, 8/10, 0 ([README.md Results](https://github.com/joyahmed/sentinel-pocket#results), [docs/EVAL.md](https://github.com/joyahmed/sentinel-pocket/blob/main/docs/EVAL.md)). Limits stated openly ([README.md Limits](https://github.com/joyahmed/sentinel-pocket#limits)). |
| **Quality of the Idea**: a creative, non-obvious use of Firebase AI Logic, and real understanding of the problem | Hybrid inference used as a privacy line: private data is judged on the device, and only a scrubbed copy the owner has seen goes to the cloud ([src/lib/scrub.ts](https://github.com/joyahmed/sentinel-pocket/blob/main/src/lib/scrub.ts), [src/hooks/use-investigate.ts](https://github.com/joyahmed/sentinel-pocket/blob/main/src/hooks/use-investigate.ts)). Offline triage when the network may be under attack. The two-pass design came from measured failures: notes excused attacks, no notes meant 45 false alarms ([docs/EVAL.md, Round 3](https://github.com/joyahmed/sentinel-pocket/blob/main/docs/EVAL.md#round-3-two-passes-notes-may-only-lower-a-verdict)). |

## Submission checklist

- [x] Built with Firebase AI Logic, imported and called at runtime (`src/lib/firebase.ts`, `src/hooks/use-triage.ts`)
- [x] App Check (reCAPTCHA Enterprise)
- [x] Platform: Web (Chrome), Gemini Nano
- [x] Public repo with an open source licence (Apache-2.0, `LICENSE`)
- [x] Live URL: https://sentinel-pocket.web.app
- [x] Text description: how Firebase AI Logic is used, features, value (above)
- [x] Video on YouTube, public, English, 3:00 or less: https://youtu.be/bxhhcbc0pzo (script: `docs/VIDEO.md`)
- [x] Licence shows in the GitHub "About" section
