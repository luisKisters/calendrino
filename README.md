# Calendrino

Turn a photo, screenshot, or PDF into a Google Calendar event in seconds — using
**your own** AI provider API key. Built with **Tauri 2** (Android · macOS ·
desktop) and **React**.

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

No backend: on native, the AI request goes **straight from the app to the
selected provider** using the Tauri HTTP plugin (which bypasses webview CORS)
with your own key. Nothing is proxied or stored on a server.

## Quick start (desktop)

Prerequisites: **Node 20+** and **Rust** (via [rustup](https://rustup.rs)).

```bash
pnpm install
pnpm run tauri dev      # launches the desktop app
```

On first launch, choose Gemini, Anthropic, OpenAI, or OpenRouter and paste your
API key. The key is stored only on your device.

Frontend-only preview (UI in the browser; native APIs/AI call won't work there):

```bash
pnpm run dev
```

## Build

```bash
pnpm run tauri build    # desktop bundle for the current OS
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
    ai.ts         extractEvents() — AI SDK call (uses Tauri fetch)
    gcal.ts       buildGCalUrl() — Google Calendar prefill URL
    datetime.ts   local-time parsing/formatting helpers
    store.ts      API key persistence (Tauri store / localStorage)
    platform.ts   isTauri(), aiFetch, openExternal()
  components/      Settings · Capture · Processing · Review · EventCard · ErrorView · Header
  App.tsx         screen state machine
src-tauri/        Rust shell, plugin registration, capabilities, config
docs/plans/       PRD, plan1 (V0), ideas (roadmap)
```

## Privacy

Local-first. Your API key lives on-device (V0 uses the store plugin; hardening to
the OS keychain is a planned follow-up). Captured files are sent only to the
selected AI provider with your key. There is no Calendrino server.

## Provider defaults

| Provider | Default model | Images | PDFs |
|---|---|---:|---:|
| Gemini | `gemini-3.1-pro-preview` | Yes | Yes |
| Anthropic | `claude-sonnet-4-5-20250929` | Yes | No |
| OpenAI | `gpt-4.1` | Yes | No |
| OpenRouter | `moonshotai/kimi-k2.6` | Yes | Yes |

Model IDs are editable in Settings. PDF uploads are currently enabled for Gemini
and OpenRouter only.
