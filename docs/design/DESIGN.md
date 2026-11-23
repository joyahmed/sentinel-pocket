# DESIGN.md - Sentinel Pocket

**Status: picked direction: C Night Watch, pure black background.**

The one change from the mockup card: the ground is pure black `#000000` instead of
`#080B14`. Surfaces and borders were re-tuned so cards still separate from black.
Everything else is card C as proposed.

Mockup (static, illustrative numbers - not measured): `c-night-watch.html`,
`c-night-watch-1440.png`, `c-night-watch-390.png`. The mockup still shows the old
`#080B14` ground; this file wins where they differ.

## Brief

- **Who:** hackathon judges (Google / Firebase), watching a demo video of 3 minutes or less; after that, a solo admin running a small server.
- **Feel in 5 seconds:** relief - "most of this is nothing, and I can see the one that isn't".
- **Kind:** single-screen tool. Desktop Chrome first (Gemini Nano runs there); phone layout works too.
- **Where it lives:** a screen recording at 1080p in a YouTube player: big counts, big verdicts, little small grey text.

## Night Watch - "the pager on your nightstand that finally tells you to go back to sleep"

- **Soul notes:** 3 a.m. light, one red LED in a dark room; the on-call sysadmin; the words "go back to sleep".
- **Signature idea - the heartbeat:** the night's alerts drawn as one thin line across the top. Noise is flat, check is a small amber bump, danger is a glowing red spike. Click a spike and you land on that alert.
- **Headline:** "**N** need you. M are noise. Go back to sleep." N = danger + check, M = noise. Every number on screen is computed from the verdicts that came back.

### Palette (tokens in `src/app/globals.css`, `@theme`)

| Token | Hex | Use |
|---|---|---|
| `ground` | `#000000` | page background (70%) - **pure black, changed from the mockup** |
| `surface` | `#0B0D12` | raised cards, code blocks, detail panel (20%) |
| `surface-2` | `#12151C` | selected row, hover, inputs |
| `line` | `#1A1F29` | 1px hairline borders and row rules |
| `line-strong` | `#2A3140` | outlined buttons, flat trace line |
| `ink` | `#E3E8F2` | text |
| `muted` | `#7D8AA6` | secondary text, labels |
| `danger` | `#FF4D3D` | danger verdict, the red LED, the main action |
| `check` | `#F5B83D` | check verdict |
| `device` | `#7CC4FF` | "on this device" badge, scrubbed lines in the diff |
| `noise` | `#6B7896` | noise verdict text (4.6:1 on black); `noise-dim` `#4F5D78` for LEDs and dim lines |

Red means danger, amber means check, grey means noise. Sky blue means "stayed on this
machine". Cloud answers get a plain ink outline, never sky blue.

### Fonts

- **Martian Mono** 300-800 (display, data, chips, timestamps) - `next/font/google`.
- **Manrope** 400-700 (sentences: reasons, next steps, explanations) - `next/font/google`.

Type scale: headline 30 (390) / 54 (1440) in Martian Mono 300 with the count at 800;
section 22/30 Martian Mono 300; detail title 22/26 Manrope 700; rows 12 mono at 44px
row height (40 on desktop); body 14-15.

### Shape, layout, motion

- **Shape:** 4-6px radius; 1px hairline borders; no shadows except the red glow on danger spikes.
- **Layout:** status strip -> headline + heartbeat -> list | detail (detail is an in-place panel, not a route) -> "leaving this machine" preview inside the detail. `/eval` uses the same shell with a mono table and big numbers on the right. 390: one column, the detail stacks under the list. 1440: list 1.2fr | detail 1fr.
- **Motion:** the trace draws left to right in 1200ms when sorting finishes; danger LEDs pulse slowly (2s, opacity 0.6 -> 1); rows fade in as each verdict arrives. No bounce. All of it is off under `prefers-reduced-motion`.
- **Honesty rules:** no placeholder numbers in the shipped UI. If on-device AI is missing, the status strip says so in words and the app keeps working through the cloud fallback. Before anything goes to the cloud for a deep look, the user sees the scrubbed bundle as a red/blue diff and must click to send.

## Category conventions kept

Severity first in every row; counts at the top; list left, detail right (stacked on a
phone); detail opens with one sentence then the raw line in mono; next step plus one
main action; tabular mono timestamps; a status strip for on-device / cloud / offline.

## Not chosen (2026-11-23)

- **A. The Redaction Desk** - paper case file, black marker bars over IPs, rubber-stamp verdicts (Instrument Serif / Public Sans / Courier Prime on #EFE8DA). Files: `a-redaction-desk.*`.
- **B. Triage Lanes** - airport belt dropping alerts into three full-colour lanes with huge counts (Big Shoulders / Figtree on white, hard shadows). Files: `b-triage-lanes.*`.

Avoid list still applies: no Inter, Geist, JetBrains Mono, IBM Plex; no teal.
