# Calendrino — Vision & Ideas Backlog

> Everything beyond the first slice. The buildable V0 lives in
> [`plan1.md`](./plan1.md); the raw intent lives in
> [`PRD_v0_brainstorming.md`](./PRD_v0_brainstorming.md).
> This file is a living backlog — reorder freely.

---

## 1. Vision

**Point your phone at anything that contains a date — a poster, a flyer, a PDF
invite, a screenshot, a spoken sentence — and it's in your calendar in seconds.**
Calendrino turns "capture → AI understands → confirm → it's on my calendar" into
a two‑tap reflex, on every device, using **your own** AI key and **your own**
calendars.

Principles:
- **Fast & native‑feeling first** (Android is the hero platform).
- **Your keys, your data** — BYO API key; local‑first; no lock‑in to our keys.
- **Trust through confirmation** — AI suggests, you approve.
- **One frontend, every platform** (Tauri native + PWA).

## 2. Platforms & priority

> ✅ **Confirmed 2026‑06‑05:** Android first, **macOS desktop next**; iOS & web later.

1. **Android** (hero — must be fast) — Tauri native.
2. **macOS desktop** — Tauri native (also our dev machine; near‑free).
3. **iOS** — Tauri native (adds share extension + perms work).
4. **Browser / PWA** — same React app, hosted, with web fallbacks.
5. **Windows / Linux** — Tauri native, low effort once desktop works.

## 3. Roadmap (feature backlog by version)

### V0.0001 — *the slice* → see [`plan1.md`](./plan1.md)
Image/PDF → Gemini → confirm → Google Calendar pre‑fill. BYO Gemini key. No
backend. Android + desktop/dev‑browser.

### V0.002 — Share & Voice
- **OS Share‑target**: "Share → Calendrino" for images/PDFs/text/links.
  - Android: `intent-filter` (`SEND` / `SEND_MULTIPLE`) on the main activity.
  - iOS: a **Share Extension** (native, separate target) handing data to the app.
- **Voice capture**: record in‑app → send audio to Gemini (native audio
  understanding) → events. Mic permissions on Android/iOS.
- The "three‑button capture" (Camera / File / Voice) from the brainstorm, polished.

### V0.01 — Android Quick‑Settings Tile & capture polish
- **Quick Settings tile** (swipe‑down → tap → opens capture instantly).
  Needs a native Kotlin `TileService` exposed to the Tauri app (custom plugin).
- Real in‑app **camera** screen (live preview, switch lens, retake) instead of
  the system `<input capture>` — via `getUserMedia` or a native camera plugin.
- Multi‑shot / multi‑page document capture.

### V0.05 — macOS desktop (confirmed 2nd platform)
- *Near‑free:* Tauri already builds desktop from the V0 code, so this is mostly
  **distribution + desktop UX**, and can be pulled forward anytime.
- Sign + notarize a macOS app; window sizing; **drag‑and‑drop a file** onto the
  window; keyboard flow; menu bar.
- (Windows / Linux follow later at low effort.)

### V0.1 — Multi‑model via Vercel AI Gateway
- Swap the model layer to the **AI Gateway** so users can choose Gemini / GPT /
  Claude / etc. with one key.
- **Settings → Provider**: "Google direct (Gemini key)" **or** "AI Gateway key"
  **or** advanced **BYOK** (attach own provider keys behind the gateway).
- Model picker + sensible default; remember per‑user choice.
- (Hosted **web / PWA** is deprioritized vs. native — see "Later".)

### Parked — OAuth Calendar API write (deprioritized 2026‑06‑05)
**Decision: stay URL‑pre‑fill‑only.** We are *not* building Google OAuth /
Calendar API for now. How the brainstorm's "calendar" asks are met without it:
- **"Multiple calendars / stays connected"** → handled by **Google's own create
  dialog**: the user picks the destination calendar there (their Google session
  stays logged in), so Calendrino needs no calendar permissions at all.
- **Trade‑offs accepted:** no silent auto‑create, can't pre‑select the target
  calendar from our UI, and batch is one‑confirm‑at‑a‑time.
- **Escape hatch (only if ever wanted):** OAuth + Calendar API would unlock
  silent auto‑create, per‑capture calendar targeting, batch add, and conflict
  detection — but it pulls in a backend for token storage. Left here on purpose,
  not scheduled.

### V1 — (Optional) Backend: history & sync
*Local‑first is the standing decision, so a backend is **optional** — it only
earns its place when these are wanted:*
- Capture **history**, settings/model **sync** across devices, undo.
- (No OAuth token storage needed while we stay pre‑fill‑only.)
- Optional managed‑key tier for users who don't want to BYO.
- If/when added: **Convex** (least ops, your prior pick) or **PocketBase** (cheap
  self‑host) — see §7. Keep it behind a thin data interface.

### Later / nice‑to‑have
- Recurring events; reminders/notifications; attendees from contacts; map link
  for location.
- **`.ics` export** + Apple Calendar / Outlook handoff (not just Google).
- On‑device pre‑filter (cheap model / OCR) to cut cost before the big model.
- Edit‑before‑create everything; **undo** last add.
- Localization / multi‑language extraction (already strong with Gemini).
- Widgets; Wear OS / watch capture.
- "Forward an email → event" (email‑in address).

## 4. Tech‑stack rationale & alternatives

**Chosen: Tauri 2 + React/TS + AI SDK + Gemini.** (User‑requested Tauri.)

| Option | Android | iOS | macOS | Browser | Native feel | Notes |
|---|---|---|---|---|---|---|
| **Tauri 2** ✅ | ✅ | ✅ | ✅ | ⚠️ via separate PWA | High, tiny binaries, Rust core | "The Mobile Update"; native plugins in Kotlin/Swift. **No direct browser target.** |
| React Native (+ RN Web) | ✅ | ✅ | ⚠️ Catalyst/macOS | ✅ | Truly native UI | Heavier; different mental model; web via RN‑Web is partial. |
| Capacitor + web | ✅ | ✅ | ⚠️ | ✅ | Web‑in‑webview | Closest "one codebase incl. web", but less "native/fast" than Tauri's Rust core. |
| Flutter | ✅ | ✅ | ✅ | ✅ | Native | Dart; no JS/AI‑SDK reuse. |

**Why Tauri wins here:** user asked for it; smallest/fastest native shell; one
web frontend across Android/iOS/macOS/desktop; Rust for any heavy/native bits.
**The one gap is the browser** — solvable later by shipping the same React app as
a **PWA** with capability fallbacks (deprioritized vs. native; see "Later").

Frontend = **React + TS + Vite** (user familiarity, AI‑SDK hooks). Tailwind for
fast mobile‑first UI. (Svelte/Solid would be leaner but cost ecosystem/AI‑SDK
ergonomics — revisit only if bundle size bites.)

## 5. AI provider strategy

- **Model:** Gemini 3.1 Pro = `gemini-3.1-pro-preview` (direct) /
  `google/gemini-3.1-pro-preview` (gateway). `gemini-3-pro-preview` was retired
  2026‑03‑26 → don't use. `gemini-3.5-flash` is the cheap/fast fallback for
  simple captures.
- **Multimodal in one call:** image + PDF natively; audio for voice. No separate
  OCR/transcription step needed (can add a cheap pre‑pass later for cost).
- **Structured output:** AI SDK `generateObject` + Zod → typed `Event[]`.
- **BYO key, no backend (V0):** call the provider straight from the client using
  Tauri's HTTP `fetch` (bypasses CORS); key stored on device. We never proxy or
  see keys.
- **Why also offer AI Gateway (V0.1):** one endpoint → many models, usage
  observability, and **BYOK with zero markup**. Lets power users pick GPT/Claude
  without us writing per‑provider code.
- **Cost control ideas:** default to Flash for plain text/screenshots, escalate
  to Pro for dense docs; cache; downscale images before upload.

## 6. Calendar integration strategy

| Method | Creates event? | Pick calendar? | Multi/batch? | Login? | Use |
|---|---|---|---|---|---|
| **Render URL pre‑fill** (V0) | User confirms in GCal | ❌ (user picks in dialog) | One at a time | ❌ | Zero‑friction default; great for trust. |
| **Android Intent** (`ACTION_INSERT`) | Opens native editor | ❌ | One at a time | ❌ | Android‑native alt to URL; needs Kotlin. |
| **Google Calendar API + OAuth** (parked) | ✅ directly | ✅ | ✅ batch | ✅ | Real multi‑calendar / "stays connected" — **deprioritized**, not scheduled. |
| **`.ics` file** (later) | Via OS handler | depends | bundle | ❌ | Cross‑provider (Apple/Outlook), offline. |

**Decision (2026‑06‑05): URL pre‑fill only — committed.** The OAuth API row is
**parked / not scheduled** (see roadmap); choosing the destination calendar is
delegated to Google's own create dialog.

## 7. Backend options (answering "how much does it take?")

V0 needs **no backend** — and per the 2026‑06‑05 decision (local‑first,
pre‑fill‑only) none is planned. A backend would only become useful for *optional*
history and cross‑device sync (V1); there are no OAuth tokens to store.

| Option | Hosting | Resource cost | Free tier | Fit |
|---|---|---|---|---|
| **None (local‑first)** | — | $0 | n/a | ✅ V0 / as long as possible. |
| **PocketBase** | Self‑host single Go binary (SQLite) | **Very light** — ~tens of MB RAM; runs on a $4–6/mo VPS or a Raspberry Pi; one file. | Free (self‑host; you pay only the VPS). | Great if you want to self‑host cheap; auth + DB + file storage built‑in. |
| **Convex** | Managed SaaS (self‑host now possible) | Offloaded to Convex | Generous free tier (good for indie scale) | User has used it & likes it; reactive, great DX, easy auth; least ops. |
| **Supabase** | Managed/self‑host (Postgres) | Heavier than PocketBase | Free tier | If you want Postgres + RLS. |

**Recommendation (per 2026‑06‑05 decision — local‑first, pre‑fill‑only):** stay
**backend‑less indefinitely**. With no OAuth, the only reason to add one is
optional **history/sync** (V1). If that day comes, default to **Convex** (your
preference, least ops); pick **PocketBase** only if cheap self‑hosting is a hard
requirement. Keep the data layer behind a thin interface so it's swappable.

## 8. Native capability map (how each is achieved in Tauri)

| Capability | Android | iOS | macOS/Desktop | Web/PWA | Version |
|---|---|---|---|---|---|
| Pick file | web `<input>` / dialog plugin | same | dialog plugin | `<input>` | V0 |
| Camera (quick) | `<input capture>` | `<input capture>` | webcam/`getUserMedia` | `<input capture>` | V0 |
| Camera (live) | native/`getUserMedia` | `getUserMedia` (WKWebView ≥14.3) | `getUserMedia` | `getUserMedia` | V0.01 |
| Voice record | `MediaRecorder` + mic perm | `MediaRecorder` + mic perm | `MediaRecorder` | `MediaRecorder` | V0.002 |
| Open GCal URL | opener plugin | opener plugin | opener plugin | `window.open` | V0 |
| Share‑target (receive) | `intent-filter` | Share Extension | — | Web Share Target (PWA) | V0.002 |
| Quick‑Settings tile | Kotlin `TileService` (custom plugin) | — (no equiv) | — | — | V0.01 |
| Calendar API/OAuth | system browser / app auth | ASWebAuthSession | system browser | redirect | parked |

## 9. Privacy & security

- **Local‑first:** API key + settings on device. Harden V0's `store` to OS
  keychain / `tauri-plugin-stronghold` before any public/store release.
- **Data flow:** captured bytes go **only** to the chosen AI provider with the
  **user's** key; there is no Calendrino server in V0.
- No OAuth in the plan, so there are **no calendar tokens to store**. (If OAuth
  is ever un‑parked, store refresh tokens server‑side with least‑privilege
  scopes and never log token/key contents.)
- Be explicit in‑app about what's sent where (short privacy note on the key
  screen).

## 10. Decisions (confirmed 2026‑06‑05)

1. **2nd platform = macOS desktop** (after Android). iOS / web come later.
2. **Local‑first as long as possible** — no accounts/backend until *optional*
   history/sync genuinely calls for it.
3. **Calendar = URL pre‑fill only.** OAuth Calendar API is **parked** (not
   scheduled); the destination calendar is chosen in Google's own dialog.
4. **App name = "Calendrino"** — use for bundle id, app title, and icons.

_No open questions blocking the roadmap. Next concrete step: build V0 per
[`plan1.md`](./plan1.md), starting at milestone M0._
