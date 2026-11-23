# Hosting on Firebase Hosting

Verdict: the app can be a plain static export. Nothing in it needs a server.

## What was checked (src/)

- No API routes or route handlers (no `route.ts` files).
- No server actions (no `"use server"`).
- No middleware or proxy file.
- No `cookies()`, `headers()`, `redirect()`, `notFound()`, `generateStaticParams`, or `dynamic`/`runtime` exports.
- Pages: `/`, `/eval`, `/smoke`. All static. Alert data is imported from `data/alerts.json` at build time, so there is no fetch.
- All Firebase calls (AI Logic, App Check) run in the browser.
- One catch: `src/app/page.tsx` uses `next/image`. The default image loader needs a server, so a static export needs `images.unoptimized: true`.
- Unverified: `next build` was not run (the dev server is busy), so the export itself is untested. `cacheComponents` is on in `next.config.ts`; confirm it builds together with `output: "export"` on Next 16.4.6, and drop it if it does not.

## next.config.ts change needed (not applied)

Add two keys to the config object:

```ts
output: "export",
images: { unoptimized: true },
```

Everything else stays. SPA rewrites are not needed: each route is pre-rendered to its own HTML file, and `cleanUrls` serves `/eval` from `eval.html`.

## Deploy

`NEXT_PUBLIC_*` values must be set at build time (they are baked into the browser bundle).

```
pnpm build                                   # writes ./out
pnpm dlx firebase-tools deploy --only hosting
```

The reCAPTCHA Enterprise key must allow the hosting domains
(`sentinel-pocket.web.app` and `sentinel-pocket.firebaseapp.com`).
