# Calendrino

Turn a photo, screenshot, or PDF into a Google Calendar event in seconds — using
**your own** AI provider API key. Built with **Tauri 2** (Android · macOS ·
desktop), **React**, and an installable web/PWA build.

> **Status: V0 (v0.0001).** The thinnest useful slice: capture → AI extracts the
> event(s) → you confirm → Google Calendar opens pre-filled. No account, no
> server, no calendar OAuth. See [`docs/plans/plan1.md`](docs/plans/plan1.md) for
> the V0 spec and [`docs/plans/ideas.md`](docs/plans/ideas.md) for the roadmap.

## Visual design

Calendrino uses a **Risograph** aesthetic: warm paper stock (`#F3E9D2`), two
overprinted spot inks (teal `#2A7E7B` + red `#F4502B`, `mix-blend-mode: multiply`),
paper grain, halftone shading, deliberate misregistration, and rubber-stamp
confirmations. Type is Bricolage Grotesque (display) + DM Sans (body) + Space Mono
(labels). All icons are inline SVG — no emoji.

The reference design is at [`docs/brand/riso-flow.html`](docs/brand/riso-flow.html).
Shared UI primitives live in `src/components/riso/` (Icon, RisoButton, RisoField,
RisoTextarea, CaptureFrame, Sheet, Stamp, Halftone, Logo). Design tokens are
defined in the `@theme` block at the top of `src/index.css`.

To regenerate app icons from the riso source mark:

```bash
pnpm tauri icon ./app-icon.png   # rebuilds src-tauri/icons/* from the 1024×1024 source
```

## How it works

1. **Capture** — tap to enable an in-frame live camera preview, use the shutter,
   or upload an image/PDF. When camera access is unavailable or denied, Calendrino
   falls back to the platform's native camera/file picker.
2. **Guide** — optional custom instructions can be saved globally in Settings, and
   a one-time note can be added from the capture screen for the next scan only.
3. **Extract** — the file and relevant instructions are sent to your selected AI
   provider via the Vercel AI SDK. The processing screen shows the captured image
   or first PDF page while a streaming agent transcript reports status, model
   reasoning when available, and detected event titles.
4. **Confirm** — review/edit the detected event(s).
5. **Add** — opens the Google Calendar "create event" form, pre-filled.

Native builds send the AI request **straight from the app to the selected
provider** using the Tauri HTTP plugin, which bypasses webview CORS. Browser/PWA
builds send the same transient request through the same-origin Vercel Function
at `/api/extract-stream` so provider CORS does not block the streaming transcript
flow. The older `/api/extract` JSON endpoint remains for non-streaming callers and
tests.

## Quick start (desktop)

Prerequisites: **Node 20+** and **Rust** (via [rustup](https://rustup.rs)).

```bash
pnpm install
pnpm run tauri dev      # launches the desktop app
```

On first launch, choose Gemini, Anthropic, OpenAI, OpenRouter, or DeepSeek and
paste your API key. The key is stored only on your device. Settings also include
optional custom instructions that apply to every scan until changed.

Browser/PWA preview:

```bash
pnpm run dev
```

That starts Vite on `http://localhost:1420` / `http://127.0.0.1:1420`. In web
mode, settings use `localStorage`, Google Calendar opens in a browser tab, and
AI extraction posts to `/api/extract-stream`.

## Build

```bash
pnpm run tauri build    # desktop bundle for the current OS
pnpm run build          # production web/PWA build in dist/
pnpm run preview        # production-like local PWA preview
```

Android & iOS: see [`BUILDING.md`](BUILDING.md).

## Testing

```bash
pnpm run test       # unit tests (+ live extraction tests, see below)
pnpm run test:e2e   # Playwright e2e (desktop + mobile viewport)
pnpm run test:all   # both — this is what CI runs
```

Unit tests are fully mocked and always run. Alongside them,
`src/test/integration/live.test.ts` runs **real** extraction against each
provider — covering both the native (`extractEventsDirect`) and PWA
(`/api/extract`) code paths — using a committed sample event as a PDF and a PNG
(`src/test/fixtures/`, regenerate with `node scripts/make-fixtures.mjs`). A
provider's live tests only run when its API key is in the environment
(`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`, `OPENROUTER_API_KEY`,
`DEEPSEEK_API_KEY`); otherwise they skip, and provider-side
failures (no quota, bad key, model JSON-mode flakiness) skip rather than fail.
In CI the keys come from GitHub Actions secrets, never the repo.

## Tech stack

| | |
|---|---|
| Shell | Tauri 2 (Rust) |
| Frontend | React 19 + TypeScript + Vite |
| Styling | Tailwind CSS v4 |
| AI | Vercel AI SDK (`ai`) + Gemini, Anthropic, OpenAI, OpenRouter, DeepSeek providers |
| Validation | Zod |
| Tauri plugins | `http` (CORS-free AI calls), `opener` (open GCal), `store` (key storage), `dialog` |

## Project structure

```
src/
  lib/
    schema.ts     Zod event schema + CalendarEvent type
    ai.ts         extractEvents()/streamExtraction() — Tauri direct calls or browser API proxy
    aiCore.ts     shared provider/model construction + AI SDK calls
    aiContract.ts shared extraction request/response contract
    transcript.ts TranscriptChunk contract for streaming status/thinking/found/done/error chunks
    pdfPreview.ts first-page PDF rendering + image preview URL helpers
    gcal.ts       buildGCalUrl() — Google Calendar prefill URL
    datetime.ts   local-time parsing/formatting helpers
    store.ts      API key persistence (Tauri store / localStorage)
    platform.ts   isTauri(), aiFetch, openExternal()
  components/
    riso/          Shared riso primitives: Icon · RisoButton · RisoField · RisoTextarea · CaptureFrame · Sheet · Stamp · Halftone · Logo
                   Settings · Capture · Processing · Review · EventCard · ErrorView · Header · Success
  App.tsx         screen state machine
api/              Vercel Functions for browser/PWA AI extraction and NDJSON streaming
src-tauri/        Rust shell, plugin registration, capabilities, config
docs/plans/       PRD, plan1 (V0), ideas (roadmap)
```

## Privacy

Native mode is local-first. Your API key lives on-device (V0 uses the store
plugin; hardening to the OS keychain is a planned follow-up), and captured files
and custom instructions are sent only to the selected AI provider with your key.
One-time scan notes are cleared after the scan finishes. In browser/PWA mode,
your API key, captured file, and relevant instructions are sent transiently to
the deployed Vercel Function, which forwards the extraction request and does not
store them.

## Provider defaults

| Provider | Default model | Images | PDFs |
|---|---|---:|---:|
| Gemini | `gemini-3.1-pro-preview` | Yes | Yes |
| Anthropic | `claude-haiku-4-5` | Yes | Yes |
| OpenAI | `gpt-5.4-mini` | Yes | Yes |
| OpenRouter | `moonshotai/kimi-k2.6` | Yes | Yes |
| DeepSeek | `deepseek-v4-flash` | No | Via text |

Model IDs are editable in Settings. PDF uploads work on every provider —
natively on Gemini, Anthropic, OpenAI, and OpenRouter, and via client-side text
extraction on DeepSeek.

**Kimi K2.6:** OpenRouter's default upstreams are slow and intermittently fail
JSON-mode extraction, so the OpenRouter provider is automatically pinned to the
**Weights & Biases** ([W&B Inference](https://docs.wandb.ai/inference)) upstream
for Kimi — faster and reliable, with no separate key needed (it is no longer a
separately selectable provider). **DeepSeek** is wired up (with thinking disabled
for fast, minimal-reasoning responses); `deepseek-v4-flash` is text-only, so PDFs
are sent to it as client-extracted text and photos aren't supported.
