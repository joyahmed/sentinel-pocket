# Demo video script (3:00 max)

Read the lines in quotes (`>`) aloud at a calm pace. Everything else is what to click.
Spoken words: 342 (about 120 words a minute, so it fits in 3:00 with pauses for the clicks).
The script is in my own voice: I read it as written.

Recording: the Mac screen, Chrome only, `http://localhost:3210`.

## Before recording

- [ ] Dev server running on the Mac on `localhost:3210`; the home page loads.
- [ ] Nano warmed up: open `/smoke` and run one test prompt, or load "Nov 20" once and let it finish. The first call after a cold start is slow.
- [ ] Status strip shows "on-device ready" and "online".
- [ ] Wi-Fi off test done once: load a night while offline and check it still sorts. Turn Wi-Fi back on.
- [ ] Eval run done BEFORE recording, in its own tab: `/eval`, alerts = all, house notes ON, limit 0, press "run". It takes about 9 minutes. Do not reload that tab afterwards.
- [ ] Browser zoom 125% (text must read in a 1080p YouTube player). Window full screen.
- [ ] Close every other tab and window. Hide the bookmarks bar.
- [ ] Do Not Disturb on; notifications off.
- [ ] Cloud quota: the free tier returns 429 under heavy use. Do NOT test "Send scrubbed bundle" before recording. Do the investigate shot once, in the take. If it shows the rate-limit message, wait a minute and redo only that section.
- [ ] Have `README.md` open in a second tab on the Results table, as a backup for the eval section.

## 0:00-0:20 Hook

> This is one small server I run. In ten days it raised over fifteen hundred security alerts. Almost all of them are nothing. But one of them might be a real break-in. Sentinel Pocket sorts them for me, and my logs never leave my laptop.

Shots:
1. Home page `/`, empty list, status strip at the top ("on-device ready", "online").
2. Click "paste alerts" to show the box, then close it again ("close paste box").

## 0:20-1:10 A night, sorted on this device

> Let me load a real night: eighteen alerts from the last two days, scrubbed. Each one is judged by Gemini Nano, the model built into Chrome, right here on this Mac. Look at the badge: ran on this device. No upload, no cost. It works in two passes. First, Nano judges the alert on its own. Then code checks eleven hard signs, like a new SSH key for root. A hard sign is always danger. Only after that may my house notes lower a verdict to noise. Here is a danger alert. It tells me why in one sentence, and what to do next.

Shots:
1. Click the sample night "Nov 22-23 · 18".
2. Let the rows fill in (about 40 s; speed this part up in the edit if needed). The heartbeat line draws across the top when sorting finishes.
3. Point the cursor at the headline ("N need you. M are noise.").
4. Click the top red row (danger sorts first). The detail panel opens.
5. Hover the badge "◆ ran on this device · … ms", then the reason and "Next step".

## 1:10-1:35 Wi-Fi off, still works

> Now I turn Wi-Fi off. The strip says offline. I load another day, and it keeps sorting, because the model lives in this browser. That matters at three in the morning, when the network may be the thing under attack.

Shots:
1. Turn Wi-Fi off from the macOS menu bar (keep it in frame).
2. Status strip turns to "offline"; the notice says "Offline. Sorting still works: the model lives in this Chrome."
3. Click "Nov 20 · 22". Rows keep filling in with "◆ ran on this device".
4. Turn Wi-Fi back on before the next section; wait for "online".

## 1:35-2:15 Investigate deeper, in the cloud

> For a deeper look I want the bigger cloud model. I open a danger alert and press Investigate deeper. Before anything leaves, I see exactly what would be sent. IP addresses, user names, app names and secret paths are swapped for tokens. Only the scrubbed version goes. I click send. Gemini in the cloud reads the related alerts as one story, and this answer is labelled: ran in the cloud.

Shots:
1. Click "Nov 22-23 · 18" again (or go back to it if it is still loaded) and wait for it to finish.
2. Click the top red row, then "Investigate deeper →".
3. The "leaving this machine" preview opens: red lines stay here, blue lines would leave. Slowly scroll it so the tokens (IP_1, USER_1, APP_1, PATH_1) are readable.
4. Click "Send scrubbed bundle" once. Wait for the answer.
5. Hover the badge "○ ran in the cloud · Gemini · … ms".

## 2:15-2:45 Does it work? The numbers

> Does it work? I labelled two hundred sixty-six alerts; twenty-one are real danger. All on this device: ninety-nine point two percent exact, nineteen of twenty-one dangers caught, zero false alarms. On the half I held out from tuning: ninety-eight point five percent, eight of ten, zero false alarms. The two misses are written up in the repo.

Shots:
1. Switch to the `/eval` tab with the finished run (alerts = all).
2. Point at the big numbers on the right: exact, danger caught, false alarms, average ms.
3. Scroll to "misses (2)" and hold for a second.
4. If the screen numbers differ from the spoken ones (a re-run can move by an alert), cut to the README Results table instead and hold on the "Held-out half (odd)" column.

## 2:45-3:00 How it is built

> It runs on Firebase AI Logic hybrid inference: on-device first, a small daily cloud budget when Chrome has no model, more cloud only when I ask, guarded by App Check. It is open source. The link is below.

Shots:
1. Show `src/lib/firebase.ts` in the editor for 3 seconds (`PREFER_ON_DEVICE`, `ONLY_ON_DEVICE`, `ONLY_IN_CLOUD`, `ReCaptchaEnterpriseProvider` in view), or the README "How Firebase AI Logic is used" section.
2. End on the GitHub repo page (https://github.com/joyahmed/sentinel-pocket) with the README visible.

## After recording

- [ ] Check the length: 3:00 or less. Trim the sorting waits first.
- [ ] Watch it once at full screen: no real names, addresses or paths visible beyond the scrubbed data.
- [ ] Upload to YouTube: visibility **Public**, language **English**, not "made for kids".
- [ ] Title suggestion: `Sentinel Pocket: on-device AI that sorts server security alerts (Firebase AI Logic, #BuildHybridAI)`
- [ ] Description suggestion:

```
Sentinel Pocket sorts server security alerts into noise, check or danger with Gemini Nano running inside Chrome, so the logs never leave your machine. It works offline.

"Investigate deeper" sends a scrubbed bundle (IPs, names and paths replaced) to Gemini in the cloud, and you see exactly what will be sent first.

Built with Firebase AI Logic (hybrid on-device and cloud inference) and App Check with reCAPTCHA Enterprise.

Measured on 266 labelled alerts, all on-device: 99.2% exact, 19 of 21 dangers caught, 0 false alarms. Held-out half: 98.5%, 8 of 10, 0 false alarms.

Code (Apache-2.0): https://github.com/joyahmed/sentinel-pocket

#BuildHybridAI
```

- [ ] Paste the YouTube link into the Devpost submission.
