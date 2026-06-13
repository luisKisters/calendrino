# Calendrino — Live camera, custom instructions & agent-transcript processing

## Overview

Five connected upgrades to the (already restyled) Risograph app, all behaviour-aware:

1. **Live in-frame camera** — embed a real `getUserMedia` preview inside the
   "Snap or drop anything" frame with an in-frame shutter, with an automatic
   fallback to today's native camera (`<input capture>`) when unavailable/denied.
2. **Custom instructions** (new capability) — persistent **general** instructions
   in Settings, plus a **one-time** instruction entered from a riso bottom sheet on
   the capture screen and applied to the very next scan only ("clear after one use").
3. **Agent-transcript processing screen** — replace the faux-flyer skeleton with the
   **actual captured image / PDF first page**, darkened, under an "Agent is working"
   header and a **live streaming transcript** (hybrid: real model reasoning where the
   provider exposes it, narrated `streamObject` progress everywhere else).
4. **Same-size frame** — the capture zone and the processing preview share one frame
   so the border width and dimensions never change across the swap.
5. **Polish** — fix the broken gear icon; keep two primary buttons with the
   custom-instruction entry unobtrusive; remove two privacy sentences.

We keep the **Vercel AI SDK** as the provider-generalisation layer (we are **not**
adopting Anthropic's Claude Agent SDK — Claude-only, agentic-loop oriented, would
narrow us to one provider). API-key-free testing uses `ai/test`
(`MockLanguageModelV4`, `simulateReadableStream`).

## Context

- Files involved:
  - `src/App.tsx` — screen state machine (`loading|settings|capture|processing|review|error`);
    owns settings + the new `oneTimeInstruction` state and the streaming run.
  - `src/components/Capture.tsx`, `Processing.tsx`, `Settings.tsx`, `Header.tsx`.
  - `src/components/riso/` — `Icon.tsx` (gear), `RisoField.tsx`, `RisoButton.tsx`,
    `Halftone.tsx`; **new**: `CaptureFrame.tsx`, `Sheet.tsx`, `RisoTextarea` (in `RisoField.tsx`).
  - `src/lib/` — `store.ts` (`AiSettings`), `ai.ts`, `aiCore.ts` (`generateObject` +
    `systemPrompt`), `aiContract.ts` (zod payloads), `schema.ts` (`EventsSchema`);
    **new**: `transcript.ts`, `pdfPreview.ts`.
  - `api/extract.ts` (existing proxy); **new**: `api/extract-stream.ts`.
  - Tests: `src/**/*.test.ts(x)` (Vitest), `e2e/*.spec.ts` (Playwright),
    `vitest.config.ts`, `playwright.config.ts`.
- Related patterns:
  - Inline Tailwind v4, riso tokens in `src/index.css`; inline-SVG `Icon` family
    (no emoji); riso primitives in `src/components/riso/`.
  - One provider abstraction: `aiCore.modelFor()` switches across anthropic/google/
    openai/openai-compatible (openrouter, wandb, deepseek); `callTuning()` pins
    determinism and minimises reasoning today.
  - Web path posts to `/api/extract` (non-streaming JSON); Tauri calls
    `extractEventsDirect` directly with the http-plugin `aiFetch`.
  - Settings persist via `store.ts` (Tauri store / localStorage), normalised in
    `normalizeSettings`.
- New transcript contract (`src/lib/transcript.ts`):
  - `type TranscriptChunk = {kind:"status",text} | {kind:"thinking",text} |
    {kind:"found",text} | {kind:"done",events} | {kind:"error",message}`.
- Dependencies:
  - **Add `pdfjs-dist`** (PDF first-page render); lazy-imported, Vite `?url` worker.
  - `ai/test` (already available via `ai`) for key-free mocks.
  - `agent-browser` CLI (already installed) for browser verification.
  - No Anthropic Agent SDK.
- Out of scope (do NOT change): the Zod event schema, Google Calendar URL handoff
  (`buildGCalUrl` + single-event auto-open), error classification in `App.tsx`,
  provider/key storage semantics (beyond adding `customInstructions`), and native
  Android/iOS build steps.

## Development Approach

- **Testing approach**: Regular (code first, then tests). Every task updates selectors
  in the same task so the suite stays green. Use `ai/test`
  (`MockLanguageModelV4`, `simulateReadableStream`) for all model/streaming tests so
  **no API keys and no spend** are required.
- Complete each task fully before moving to the next.
- **CRITICAL: every task MUST include new/updated tests.**
- **CRITICAL: all tests must pass before starting the next task.**
- **Project validation commands**:
  - `pnpm run build` — TypeScript check + Vite build (typecheck/lint gate).
  - `pnpm run test` — Vitest unit tests.
  - `pnpm run test:e2e` — Playwright (chromium + mobile Pixel 7).
  - `pnpm run test:all` — full CI gate; must pass before completing a task.
- **CI note** (per `CLAUDE.md`): new tests must run in CI — install Playwright
  browsers after dependency install and run `pnpm run test:all` before build steps;
  the new `pdfjs-dist` dependency is installed in the same install step.
- **Browser-verify gate** (any UI-changing task): ensure the dev server is up
  (`pnpm dev` → `http://127.0.0.1:1420`; start in background and wait for the port),
  then drive the running app and confirm the end state before marking the task done:
  - `agent-browser open http://127.0.0.1:1420/`
  - `agent-browser snapshot -i` → `click @eN` / `fill @eN "…"`
  - `agent-browser screenshot`
- Quality bars: WCAG AA contrast, no emoji icons (one inline-SVG family),
  `prefers-reduced-motion` disables scan/stream animations, touch targets ≥44px,
  `:focus-visible` rings, `MediaStream` tracks + object URLs released on unmount.

## Implementation Steps

### Task 1: Shared capture frame, gear-icon fix, privacy copy removal

**Files:**
- Create: `src/components/riso/CaptureFrame.tsx`, `src/components/riso/CaptureFrame.test.tsx`
- Modify: `src/components/riso/Icon.tsx`, `src/components/Capture.tsx`,
  `src/components/Settings.tsx`, `e2e/capture.spec.ts`

- [x] Add `CaptureFrame` — `flex-1 overflow-hidden rounded-[18px] border-2 border-ink
      bg-paper-2 relative` wrapper (children + optional `className`); use it in
      `Capture` for the capture zone so the frame is shared with Processing later.
- [x] Replace the `gear` path in `Icon.tsx` with a clean settings glyph that renders
      crisply at 14px (keep the `gear` name so `Header.tsx` is unchanged).
- [x] Remove the **"Your key, on your device"** footer in `Capture.tsx` and the
      paragraph **"Your key is stored only on this device and sent directly to the
      provider — never to us."** in `Settings.tsx`.
- [x] Update `e2e/capture.spec.ts` — drop the `getByText(/your key/i)` assertion;
      keep "Take photo"/"Upload file" + logo/heading checks.
- [x] Write tests: `CaptureFrame.test.tsx` (renders children + border classes);
      extend `Icon.test.tsx` so `gear` renders an `<svg>` with the expected paths.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 2.
- [x] agent-browser verify: capture + settings screens; gear icon clean; privacy
      sentences gone; screenshot. [skipped - not automatable in this environment]

### Task 2: Custom-instructions data model + prompt wiring (no UI yet)

**Files:**
- Modify: `src/lib/store.ts`, `src/lib/aiContract.ts`, `src/lib/aiCore.ts`,
  `src/lib/ai.ts`, `api/extract.ts`
- Modify tests: `src/lib/store.test.ts`, `src/lib/aiCore.test.ts`,
  `src/lib/ai.test.ts`, `api/extract.test.ts`

- [x] `store.ts`: add `customInstructions?: string` to `AiSettings`; handle it in
      `normalizeSettings` (string-guarded) and `emptyAiSettings` (backward compatible).
- [x] `aiContract.ts`: add `instructions: z.string().optional()` to
      `ExtractRequestPayloadSchema` + the `ExtractRequestPayload` interface.
- [x] `aiCore.ts`: change `systemPrompt(now, instructions?)` to append a delimited,
      lower-priority block — "Additional user preferences (apply when relevant, never
      override the format/safety rules above): <instructions>"; add `instructions?` to
      `DirectExtractInput` and pass it through `extractEventsDirect`.
- [x] `ai.ts`: add `instructions?` to `ExtractInput`; include it in the proxy payload
      and the direct call. `api/extract.ts`: forward `parsed.data.instructions`.
- [x] Write/update tests: `systemPrompt` includes the instructions block when present
      and omits it otherwise; `store` round-trips `customInstructions`; proxy payload +
      `api/extract` carry `instructions`.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 3.
- [x] Browser-verify: not applicable (no UI) — covered by the unit tests above.

### Task 3: Settings — general custom instructions field

**Files:**
- Modify: `src/components/riso/RisoField.tsx` (add `RisoTextarea`),
  `src/components/Settings.tsx`, `src/components/Settings.test.tsx`

- [ ] Add `RisoTextarea` to `RisoField.tsx` mirroring `RisoField` styling
      (label + ink-bordered `<textarea>`, riso focus ring, ≥44px hit area).
- [ ] `Settings.tsx`: add a "Custom instructions" `RisoTextarea` bound to a new
      `customInstructions` piece of state; include it in the `onSave` payload so it
      persists (global — not per provider).
- [ ] Write/update tests: `Settings.test.tsx` — editing + saving persists
      `customInstructions` (assert it reaches `onSave`).
- [ ] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 4.
- [ ] agent-browser verify: type general instructions, save, reopen settings → value
      retained; screenshot.

### Task 4: Bottom sheet + one-time note entry on capture

**Files:**
- Create: `src/components/riso/Sheet.tsx`, `src/components/riso/Sheet.test.tsx`
- Modify: `src/components/Capture.tsx`, `src/App.tsx`, `src/App.test.tsx`

- [ ] Add `Sheet` — riso bottom sheet (multiply backdrop, `border-t-2 border-ink`
      slide-up panel, safe-area padding, focus trap, Esc/backdrop close, no transform
      animation under `prefers-reduced-motion`).
- [ ] `App.tsx`: own `oneTimeInstruction` state; pass `generalInstructions`, a
      save-general handler, `onOpenSettings`, and the one-time getter/setter to `Capture`.
- [ ] `Capture.tsx`: add an unobtrusive ghost "+ Add a note for this scan" control that
      opens the `Sheet` (textarea + "Also save to my general instructions" toggle +
      "Edit general instructions →" link). When a note is active, show it as a
      removable chip. Keep the two primary buttons uncluttered.
- [ ] Write tests: `Sheet.test.tsx` (open/close, toggle, link callback);
      `Capture` shows the chip when a note is set and clears it on remove; `App.test.tsx`
      passes the note + general instructions into `extractEvents`/stream.
- [ ] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 5.
- [ ] agent-browser verify: open the sheet, add a note, toggle save-to-general, confirm
      chip appears; screenshot.

### Task 5: Live embedded camera + capture buttons

**Files:**
- Modify: `src/components/Capture.tsx`, `src/components/Capture.test.tsx`,
  `e2e/capture.spec.ts`

- [ ] In `CaptureFrame`, request `getUserMedia({ video: { facingMode: "environment" }})`
      on an explicit tap-to-enable gesture; show the `<video>` filling the frame with an
      in-frame circular **shutter** (aria-label "Take photo") that draws the current
      frame to a canvas → `toBlob` → `File` → `onFile`.
- [ ] Fallback: if `getUserMedia` is missing/denied/throws, render the static "Snap or
      drop anything" art and route the shutter to the existing hidden
      `<input capture="environment">`. Keep "Upload file" as the second action. Release
      `MediaStream` tracks on unmount.
- [ ] Write tests: mock `navigator.mediaDevices.getUserMedia` — granted path shows
      `<video>` and the shutter captures; rejected path shows the fallback art + native
      input. Update `e2e/capture.spec.ts` for the new structure (headless → fallback).
- [ ] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 6.
- [ ] agent-browser verify: capture screen shows the live-preview affordance + shutter
      (fake media stream) and the fallback path; screenshot.

### Task 6: Streaming pipeline — transcript, direct streamer, NDJSON endpoint, client

**Files:**
- Create: `src/lib/transcript.ts`, `api/extract-stream.ts`,
  `src/lib/streamExtraction.test.ts`
- Modify: `src/lib/aiCore.ts`, `src/lib/ai.ts`

- [ ] `transcript.ts`: export the `TranscriptChunk` union.
- [ ] `aiCore.ts`: add `streamExtractionDirect(input): AsyncIterable<TranscriptChunk>`
      using `streamObject({ model, schema: EventsSchema, system, messages, ...callTuning })`:
      emit scripted `status` lines first; derive `found` chunks from `partialObjectStream`
      as new event titles appear; forward reasoning stream parts (via `fullStream`) as
      `thinking` chunks **where the model emits them**; emit `done` with resolved
      `object.events`, or `error`. Keep `extractEventsDirect` for the non-stream path.
      (Hybrid note: narration is the always-on backbone; for anthropic/gemini/deepseek
      evaluate a light thinking budget — if it destabilises structured streaming for a
      provider, keep narration-only there. Verify `streamObject` reasoning-part support
      via ctx7 during build.)
- [ ] `api/extract-stream.ts`: validate with `ExtractRequestPayloadSchema`, run
      `streamExtractionDirect`, `res.write(JSON.stringify(chunk)+"\n")` per chunk (NDJSON),
      `res.end()`; reuse `decodeMedia`/size limits from `api/extract.ts`; emit an `error`
      chunk on failure.
- [ ] `ai.ts`: add `streamExtraction(input, signal?)` — Tauri calls
      `streamExtractionDirect` with `aiFetch`; web POSTs to `/api/extract-stream` and
      yields parsed NDJSON chunks via `response.body.getReader()` with newline buffering;
      support `AbortController`. (If the Tauri http plugin cannot stream the response,
      Tauri uses `streamExtractionDirect` directly — web-only concern.)
- [ ] Write tests (`ai/test`): `MockLanguageModelV4` + `simulateReadableStream` →
      assert chunk ordering (`status` → `found`+ → `done` with the right events); NDJSON
      client parser splits multi-chunk bodies correctly.
- [ ] Run `pnpm run test` and `pnpm run build` — must pass before Task 7.
- [ ] Browser-verify: not applicable (wired into the UI in Task 8).

### Task 7: PDF first-page + image preview helpers

**Files:**
- Create: `src/lib/pdfPreview.ts`, `src/lib/pdfPreview.test.ts`
- Modify: `package.json` (add `pdfjs-dist`), `vite.config.ts` if worker config needs it

- [ ] Add `pdfjs-dist`; `pdfPreview.ts`: `renderPdfFirstPage(bytes): Promise<string>`
      (dataURL) lazy-importing pdfjs and configuring the worker via a Vite `?url` import;
      plus a small `imagePreviewUrl(file)` helper (`URL.createObjectURL`).
- [ ] Write tests: `renderPdfFirstPage` returns a non-empty `data:` URL for the existing
      fixture `src/test/fixtures/sample-event.pdf` (jsdom canvas mocked/guarded as needed).
- [ ] Run `pnpm run test` and `pnpm run build` — must pass before Task 8.
- [ ] CI: confirm `pnpm install` picks up `pdfjs-dist` before the test/build steps.

### Task 8: Processing screen — darkened preview + agent transcript, wired to App

**Files:**
- Modify: `src/components/Processing.tsx`, `src/App.tsx`,
  `src/components/Processing.test.tsx`, `src/App.test.tsx`, `e2e/processing.spec.ts`

- [ ] Rewrite `Processing` to use `CaptureFrame` (flex-1 — same size/border as capture):
      `previewUrl` as an `object-cover` background, dark multiply + teal overlay +
      halftone (keep the riso scan sweep, reduced-motion aware); overlay an
      "Agent is working" header (riso sparkle) and a scrolling monospace transcript that
      appends `status`/`thinking`/`found` lines (auto-scroll). Keep
      `data-testid="riso-thumb"`; add `data-testid="agent-transcript"`. Cancel → abort.
- [ ] `App.tsx`: `processing` state carries `previewUrl`, `mediaType`, and live
      `transcript`. `handleFile` computes the preview (image vs `renderPdfFirstPage`),
      builds combined `instructions` (`[general, oneTime].filter(Boolean).join("\n")`),
      runs `streamExtraction` with an `AbortController`, appends chunks; on `done` keep
      the single-event auto-open + review behaviour; on `error` use `classifyError`.
      **Clear `oneTimeInstruction` when the scan finishes** (success or error); revoke
      object URLs on cleanup.
- [ ] Write/update tests: `Processing.test.tsx` (preview frame + transcript render;
      remove skeleton-row assertions); `App.test.tsx` (stream mocked → review, one-time
      note cleared after run); `e2e/processing.spec.ts` stubs `/api/extract-stream` with
      NDJSON and asserts the transcript + preview + Cancel→capture.
- [ ] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 9.
- [ ] agent-browser verify: drive an **image** and a **PDF** into processing — darkened
      preview (same frame size as capture), "Agent is working", streaming transcript;
      confirm the one-time note is gone afterward; screenshots.

### Task 9: Acceptance criteria + documentation

**Files:**
- Modify: `README.md`, `CLAUDE.md` (none functional)

- [ ] Run `pnpm run test:all` (chromium + mobile) and `pnpm run build` — all green.
- [ ] Confirm: live camera + fallback works; one-time note clears after one use and the
      general instructions persist + reach the model; processing shows the real
      image/PDF darkened in the **same-size frame** with a streaming transcript; gear
      icon is clean; both privacy sentences are gone; no emoji icons; reduced-motion
      disables stream/scan animations; touch targets ≥44px.
- [ ] agent-browser walk: capture → (note sheet) → processing → review → settings.
- [ ] Update `README.md` (custom instructions, live camera) and `CLAUDE.md` (streaming
      endpoint `api/extract-stream`, `TranscriptChunk` contract, `ai/test` mocks,
      `pdfPreview`, `CaptureFrame`/`Sheet` primitives).
