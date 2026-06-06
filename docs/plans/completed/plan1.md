# Calendrino — V0 (v0.0001) Plan

> The thinnest end‑to‑end slice that is genuinely useful, built on the **real**
> target stack so V0.x features bolt on without a rewrite.
> Source of truth for intent: [`PRD_v0_brainstorming.md`](./PRD_v0_brainstorming.md).
> Everything beyond V0 lives in [`ideas.md`](./ideas.md).

---

## 1. Goal (one sentence)

**Take a photo or upload a file (image / PDF) → Gemini extracts the event(s) →
you confirm → Calendrino opens Google Calendar with the event already
pre‑filled.** No account, no server, no calendar OAuth.

If exactly one event is found, jump straight to the pre‑filled Google Calendar
"create event" screen. If several are found, show a short list to pick from.

## 2. Scope

### In scope for V0
- **Capture screen** with two primary actions: **Camera** and **Upload file**.
  (A third **Voice** button is wired into the same layout but optional — see
  §11 stretch.)
- Accept **image** (`jpg/png/heic/webp`) and **PDF**.
- **Bring‑your‑own key**: user pastes a Google **Gemini API key** on first run;
  stored on‑device. We never see it.
- Call **Gemini 3.1 Pro** (multimodal) via the **Vercel AI SDK**, requesting
  **structured output** (a list of events) validated by a Zod schema.
- **Review screen**: show extracted event(s); user taps one to confirm.
- **Open in Google Calendar** pre‑filled via the `render?action=TEMPLATE` URL.
- Runs as a **native Android app** (primary) and the **same build runs on macOS
  desktop & dev browser** for fast iteration.

### Explicitly OUT of scope for V0 (see [`ideas.md`](./ideas.md))
- ❌ OS Share‑target ("share to Calendrino") → V0.002
- ❌ Android Quick‑Settings tile → V0.01
- ❌ Google OAuth / Calendar API / choosing *which* calendar / auto‑create
  without the confirm dialog / multi‑calendar "stays connected" → **parked**
  (decision: stay URL‑prefill‑only; see ideas.md)
- ❌ Multi‑model picker / AI Gateway routing (architecture is ready for it, but
  V0 ships Gemini‑direct) → V0.1
- ❌ Any backend (Convex / PocketBase), accounts, history, sync → V1
- ❌ iOS / Windows / Linux store builds (will compile, but not a V0 target)

## 3. Tech stack (decided)

| Layer | Choice | Why |
|---|---|---|
| App shell | **Tauri 2** | User‑requested. Native Android/iOS/macOS/desktop from one web frontend; small & fast; Rust core. |
| Frontend | **React + TypeScript + Vite** | User knows React; best AI‑SDK support; Vite is the Tauri default. |
| Styling | **Tailwind CSS** (+ a few headless components) | Fast, mobile‑first, tiny. |
| AI | **Vercel AI SDK v5** (`ai`) + **`@ai-sdk/google`** | `generateObject` for typed extraction; provider‑swappable so AI Gateway is a one‑line change later. |
| Model | **`gemini-3.1-pro-preview`** | User asked for "Gemini 3.1 Pro"; multimodal (image + PDF in one call). |
| Validation | **Zod** | Schema for structured event output + runtime safety. |
| Networking | **`@tauri-apps/plugin-http`** | Its `fetch` proxies through Rust → **bypasses webview CORS**, so we can call Gemini directly from the client with no backend. |
| Open URL | **`@tauri-apps/plugin-opener`** | Opens the Google Calendar URL in the Calendar app / browser. |
| Storage | **`@tauri-apps/plugin-store`** (V0) | Persist the API key + settings locally. *Harden later to OS keychain / Stronghold — see Risks.* |
| File picker | Web `<input type="file">` first; `@tauri-apps/plugin-dialog` as fallback | Web input also opens the **camera** on mobile via `capture`. |

### The "browser" caveat (important)
Tauri builds **native** apps; it does **not** deploy to the browser. But our
frontend is plain web tech, so the *same* React app can be shipped as a **PWA**
later (V0.1+) with capability fallbacks (`window.open` instead of the opener
plugin, browser `fetch` instead of the Tauri one). For V0 we get "browser" for
free as a **dev/test target** (`pnpm run dev`), and treat a real hosted PWA as a
later milestone. Android is the priority per the brainstorm.

## 4. Architecture / data flow

```
┌──────────── Tauri app (single React frontend) ────────────┐
│                                                           │
│  Capture screen                                           │
│   ├─ Camera  → <input capture> → File (image)            │
│   ├─ Upload  → <input file>    → File (image/pdf)        │
│   └─ Voice*  → MediaRecorder   → File (audio)  *optional  │
│            │                                              │
│            ▼  bytes + mimeType + { now, timezone }       │
│  extractEvents()                                          │
│   └─ AI SDK generateObject(                              │
│        model: google('gemini-3.1-pro-preview'),         │
│        schema: EventsSchema (Zod),                       │
│        fetch:  tauriFetch  ← CORS bypass, BYO key        │
│      )                                                    │
│            │                                              │
│            ▼  Event[]                                     │
│  Review screen → user confirms one                       │
│            │                                              │
│            ▼  buildGCalUrl(event)                        │
│  opener.openUrl("https://calendar.google.com/...render") │
└───────────────────────────────────────────────────────────┘
        │
        ▼
  Google Calendar app/web opens with the new‑event form PRE‑FILLED
```

No data leaves the device except the file bytes sent to Google's Gemini endpoint
using the **user's own key**. Nothing is stored server‑side (there is no server).

## 5. Event schema (the contract)

```ts
// src/lib/schema.ts
import { z } from "zod";

export const EventSchema = z.object({
  title: z.string().describe("Concise event title"),
  // Local wall-clock ISO 8601, NO timezone suffix, e.g. "2026-06-12T19:30:00"
  start: z.string().describe("ISO 8601 local start, no Z/offset"),
  end: z.string().nullable().describe("ISO 8601 local end; null → default +1h"),
  allDay: z.boolean().default(false),
  location: z.string().nullable(),
  description: z.string().nullable(),
  // IANA tz if the source implies one (e.g. a flight); else null → use device tz
  timezone: z.string().nullable().describe("IANA tz e.g. Europe/Berlin"),
  confidence: z.number().min(0).max(1).default(0.5),
});

export const EventsSchema = z.object({
  events: z.array(EventSchema),
});
export type Event = z.infer<typeof EventSchema>;
```

## 6. Extraction prompt (shape)

System prompt must pin **today's date + device timezone** so relative dates
("next Friday", "tomorrow 8pm") resolve correctly:

```
You extract calendar events from the provided image/PDF/audio.
Today is {{ISO date}} ({{weekday}}); the user's timezone is {{IANA tz}}.
Return every distinct event you can identify. Resolve relative dates against
today. If no end time is stated, leave end null. Use all-day for date-only
events. Prefer the source's timezone if one is explicit (flights, webinars);
otherwise leave timezone null. Do not invent details that are not present.
```

File is passed as a multimodal part (AI SDK `file` part with `mimeType`).
Gemini 3.1 Pro accepts images and PDFs natively in the same call.

## 7. Google Calendar URL builder (the V0 "integration")

```
https://calendar.google.com/calendar/render
  ?action=TEMPLATE
  &text={urlencoded title}
  &dates={start}/{end}
  &details={urlencoded description}
  &location={urlencoded location}
  &ctz={IANA timezone}        ← omit for all-day
```

Date formats:
- **Timed:** `YYYYMMDDTHHMMSS` (local wall‑clock, **no `Z`**) + `&ctz=<tz>`.
  If `end` is null → `start + 1h`.
- **All‑day:** `YYYYMMDD/YYYYMMDD` where the second date is **start + 1 day**
  (end is exclusive); no `ctz`.

Notes / limitations to remember:
- This **pre‑fills and lets the user confirm** — it does not silently create the
  event (good for V0 trust; exactly what the brainstorm asked for).
- The render URL **cannot choose the destination calendar** — that requires the
  Calendar API + OAuth (**parked** — we stay prefill‑only). The user picks the
  destination calendar in Google's own create dialog.
- Multiple events in V0 → open them **one at a time** after each confirm (a true
  batch/auto‑add flow needs the API → future).
- Use the opener plugin on native; on the dev browser fall back to
  `window.open(url, "_blank")`.

## 8. Screens (V0)

1. **First‑run / Settings** — single field: "Gemini API key" + link to where to
   get one + "Save". Re‑openable from a gear icon. (Validates by a tiny test
   call, optional.)
2. **Capture (home)** — big **Camera** button, **Upload file** button, optional
   **Voice** button; settings gear in the corner.
3. **Processing** — spinner + "Reading your {photo/document}…" + cancel.
4. **Review** — list of extracted events as cards (title, date/time, location);
   each editable inline (at least title/time) before confirm; **"Add to Google
   Calendar"** per card.
5. **Error** — friendly messages for: no key, bad key, no events found, network
   error. Each with a retry.

Keep it one‑thumb usable, mobile‑first, big tap targets.

## 9. Build steps / milestones (ordered & checkable)

> **Implemented 2026-06-05.** M0 + M2–M8 are done and building on desktop
> (`tsc` + `vite build` + `cargo check` all green; the Google Calendar URL logic
> was smoke-tested). **M1** (Android init) and **M9** (signed Android build) are
> not run here — they need the Android SDK; steps are in
> [`BUILDING.md`](../../BUILDING.md).

- [x] **M0 — Scaffold.** `pnpm create tauri-app@latest` (React + TS + Vite,
      app name `calendrino`). Add Tailwind. App boots on desktop.
- [ ] **M1 — Android target.** Install Android Studio + NDK; `pnpm run tauri
      android init`; run on emulator/device. App boots on Android.
- [x] **M2 — Plugins.** Add `plugin-http`, `plugin-opener`, `plugin-store`,
      `plugin-dialog`; wire capabilities/permissions in `tauri.conf.json` +
      `capabilities/`.
- [x] **M3 — Settings + key storage.** Save/load Gemini key via store plugin;
      gate the app until a key exists.
- [x] **M4 — Capture.** Camera (`<input capture="environment">`) + Upload
      (`<input type="file" accept="image/*,application/pdf">`) → in‑memory
      `File` + mimeType.
- [x] **M5 — Extraction.** AI SDK + `@ai-sdk/google` + Zod `generateObject`,
      using the **Tauri `fetch`**; pass file as multimodal part; inject
      now/timezone. Returns `Event[]`.
- [x] **M6 — Review UI.** Render event cards; inline‑edit title/time.
- [x] **M7 — Google Calendar handoff.** `buildGCalUrl()` + open via opener;
      handle single vs. multiple.
- [x] **M8 — Errors & polish.** All error states; loading; empty‑result;
      basic app icon + name.
- [ ] **M9 — Ship V0.** Build a signed Android APK/AAB; install on the user's
      phone; one real‑world dogfood pass (poster + PDF invite).

## 10. Scaffolding commands (reference)

```bash
# Scaffold (choose: React, TypeScript, pnpm)
pnpm create tauri-app@latest calendrino

cd calendrino
# Mobile target (after Android Studio + Rust targets installed)
pnpm run tauri android init

# Frontend deps
pnpm add ai @ai-sdk/google zod
pnpm add @tauri-apps/plugin-http @tauri-apps/plugin-opener \
      @tauri-apps/plugin-store @tauri-apps/plugin-dialog
pnpm add -D tailwindcss @tailwindcss/vite

# Run
pnpm run tauri dev              # desktop
pnpm run tauri android dev      # Android emulator/device
```

```ts
// src/lib/ai.ts — the BYO-key, no-backend, CORS-free call
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { fetch as tauriFetch } from "@tauri-apps/plugin-http";
import { EventsSchema } from "./schema";

export async function extractEvents(file: { bytes: Uint8Array; mimeType: string },
                                    apiKey: string, now: string, tz: string) {
  const google = createGoogleGenerativeAI({ apiKey, fetch: tauriFetch });
  const { object } = await generateObject({
    model: google("gemini-3.1-pro-preview"),
    schema: EventsSchema,
    system: buildSystemPrompt(now, tz),
    messages: [{ role: "user", content: [
      { type: "text", text: "Extract all events." },
      { type: "file", data: file.bytes, mediaType: file.mimeType },
    ]}],
  });
  return object.events;
}
```
*(Confirm exact AI SDK v5 part field names against current docs at build time.)*

## 11. Stretch (only if M0–M9 land quickly)
- **Voice input:** `MediaRecorder` in the webview → audio file → same Gemini call
  (3.1 Pro accepts audio). Needs mic permission plumbing (Android manifest +
  `NSMicrophoneUsageDescription`). If it fights us, push to V0.002.
- **Edit‑all‑fields** on the review card (location/description/end).

## 12. Risks & mitigations
| Risk | Mitigation |
|---|---|
| API key in plain `store` plugin | OK for V0 (local, single‑user). Harden to OS keychain / `tauri-plugin-stronghold` before any public release. |
| AI SDK v5 multimodal/part API names drift | Verify against current `@ai-sdk/google` docs during M5; the call is isolated in `ai.ts`. |
| Webview `getUserMedia`/`MediaRecorder` perms on mobile | V0 camera uses `<input capture>` (no getUserMedia). Voice is stretch. |
| Gemini returns junk / hallucinated dates | Zod validation + "don't invent" prompt + user confirms before anything is created. |
| Render URL can't pick target calendar | Accepted (standing decision): user picks the calendar in Google's own dialog; OAuth targeting is **parked**. |
| Tauri mobile build env friction (Android SDK/NDK) | Budget time in M1; document exact versions once working. |

## 13. Definition of Done (V0)
A signed Android build where: paste key once → tap **Camera**, shoot a poster →
within a few seconds see the correct event → tap **Add to Google Calendar** →
Google Calendar opens with title/date/time/location pre‑filled. Same works for a
**PDF** invite via **Upload**. No crashes on the unhappy paths (no key, no
network, no event found).
