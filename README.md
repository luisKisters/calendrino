# Calendrino

Turn a photo, screenshot, or PDF into a Google Calendar event in seconds — using
**your own** AI provider API key. Built with **Tauri 2** (Android · macOS ·
desktop), **React**, and an installable web/PWA build.

> **Status: V0 (v0.0001).** The thinnest useful slice: capture → AI extracts the
> event(s) → you confirm → Google Calendar opens pre-filled. No account, no
> server, no calendar OAuth. See [`docs/plans/plan1.md`](docs/plans/plan1.md) for
> the V0 spec and [`docs/plans/ideas.md`](docs/plans/ideas.md) for the roadmap.

## How it works

1. **Capture** — take a photo or upload an image/PDF.
2. **Extract** — the file is sent to your selected AI provider via the Vercel AI
   SDK, which returns structured events (Zod-validated). Supported providers are
   Gemini, Anthropic, OpenAI, and OpenRouter.
3. **Confirm** — review/edit the detected event(s).
4. **Add** — opens the Google Calendar "create event" form, pre-filled.

Native builds send the AI request **straight from the app to the selected
provider** using the Tauri HTTP plugin, which bypasses webview CORS. Browser/PWA
builds send the same transient request through the same-origin Vercel Function
at `/api/extract` so provider CORS does not block extraction.

## Quick start (desktop)

Prerequisites: **Node 20+** and **Rust** (via [rustup](https://rustup.rs)).

```bash
pnpm install
pnpm run tauri dev      # launches the desktop app
```

On first launch, choose Gemini, Anthropic, OpenAI, or OpenRouter and paste your
API key. The key is stored only on your device.

Browser/PWA preview:

```bash
pnpm run dev
```

That starts Vite on `http://localhost:1420` / `http://127.0.0.1:1420`. In web
mode, settings use `localStorage`, Google Calendar opens in a browser tab, and
AI extraction posts to `/api/extract`.

## Build

```bash
pnpm run tauri build    # desktop bundle for the current OS
pnpm run build          # production web/PWA build in dist/
pnpm run preview        # production-like local PWA preview
```

Android & iOS: see [`BUILDING.md`](BUILDING.md).

## Tech stack

| | |
|---|---|
| Shell | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| AI | Vercel AI SDK (`ai`) + Gemini, Anthropic, OpenAI, OpenRouter providers |
| Validation | Zod |
| Tauri plugins | `http` (CORS-free AI calls), `opener` (open GCal), `store` (key storage), `dialog` |

## Project structure

```
src/
  lib/
    schema.ts     Zod event schema + CalendarEvent type
    ai.ts         extractEvents() — Tauri direct call or browser /api/extract proxy
    aiCore.ts     shared provider/model construction + AI SDK call
    aiContract.ts shared /api/extract request/response contract
    gcal.ts       buildGCalUrl() — Google Calendar prefill URL
    datetime.ts   local-time parsing/formatting helpers
    store.ts      API key persistence (Tauri store / localStorage)
    platform.ts   isTauri(), aiFetch, openExternal()
  components/      Settings · Capture · Processing · Review · EventCard · ErrorView · Header
  App.tsx         screen state machine
api/              Vercel Function for browser/PWA AI extraction
src-tauri/        Rust shell, plugin registration, capabilities, config
docs/plans/       PRD, plan1 (V0), ideas (roadmap)
```

## Privacy

Native mode is local-first. Your API key lives on-device (V0 uses the store
plugin; hardening to the OS keychain is a planned follow-up), and captured files
are sent only to the selected AI provider with your key. In browser/PWA mode,
your API key and captured file are sent transiently to the deployed Vercel
Function, which forwards the extraction request and does not store them.

## Provider defaults

| Provider | Default model | Images | PDFs |
|---|---|---:|---:|
| Gemini | `gemini-3.1-pro-preview` | Yes | Yes |
| Anthropic | `claude-sonnet-4-5-20250929` | Yes | No |
| OpenAI | `gpt-4.1` | Yes | No |
| OpenRouter | `moonshotai/kimi-k2.6` | Yes | Yes |

Model IDs are editable in Settings. PDF uploads are currently enabled for Gemini
and OpenRouter only.
