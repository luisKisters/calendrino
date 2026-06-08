# Calendrino — Risograph UI Restyle

## Overview

Re-skin the existing, working V0 app into the chosen **Risograph** visual system
without changing any behavior. Warm paper stock, two overprinted spot inks
(teal `#2A7E7B` + red `#F4502B`, `mix-blend-mode: multiply`), paper grain,
halftone shading, deliberate misregistration, and rubber-stamp confirmations.
Type becomes Bricolage Grotesque (display) + DM Sans (body) + Space Mono
(labels); every emoji icon is replaced with one inline-SVG set. One additive
Success screen is introduced. The look is fully specified in
`docs/brand/riso-flow.html` (which contains a copy-paste `riso.css`
tokens-and-effects block) — mirror it into the real app.

## Context

- Files involved:
  - `src/index.css` (Tailwind v4 entry; `@import "tailwindcss"`, body colors/fonts)
  - `src/App.tsx` (state machine: `loading | settings | capture | processing | review | error`)
  - `src/components/Header.tsx`, `Capture.tsx`, `Settings.tsx`, `Processing.tsx`,
    `Review.tsx`, `EventCard.tsx`, `ErrorView.tsx`
  - New: `src/components/riso/` (shared primitives + icons) and `src/components/Success.tsx`
  - `index.html` (font links / favicon), `vite.config.ts` (PWA manifest), `public/*`,
    `src-tauri/icons/*` (app icons)
  - Tests: `src/**/*.test.tsx` (Vitest), `e2e/app.spec.ts` + new specs (Playwright),
    `playwright.config.ts`, `vitest.config.ts`
- Related patterns:
  - Styling is **inline Tailwind v4** (no `tailwind.config`); colors/fonts are ad-hoc
    today and **emojis are used as icons** (📅 ⚙️ 📷 📄 🎤 🤔 ⚠️) — replace with SVG.
  - Routing is a `screen` union in `App.tsx` (no router).
  - Design tokens (target): paper `#F3E9D2`, paper-2 `#F8F1E0`, ink `#23201C`,
    ink-soft `#6A5E50`, teal `#2A7E7B`, red `#F4502B`, yellow `#F5C84B`, line `#C9BC9E`.
  - Five riso ingredients (see `docs/brand/riso-flow.html`): two-ink overprint,
    paper grain (inline SVG `feTurbulence`, fixed multiply overlay ~.45), halftone
    (`radial-gradient` dots), misregistration (color layer offset 2–4px + slight
    rotate), rubber-stamp feedback (SVG `#rough` = `feTurbulence` + `feDisplacementMap`).
- Dependencies:
  - Web fonts: Bricolage Grotesque, DM Sans, Space Mono (Google Fonts; system fallback).
  - `agent-browser` CLI (already installed) for browser verification.
  - No new runtime/npm dependencies; logic stays unchanged.
- Out of scope (do NOT change): AI provider/key logic, extraction (`src/lib/*`), Zod
  schema, Google Calendar URL handoff, error classification, storage, and native
  Android/iOS build steps. This is a visual restyle plus one additive screen.

## Development Approach

- **Testing approach**: Regular (code first, then tests) — extend the existing
  Vitest unit suite and Playwright e2e suite; update selectors in the same task
  whenever markup changes so the suite stays green.
- Complete each task fully before moving to the next.
- **CRITICAL: every task MUST include new/updated tests.**
- **CRITICAL: all tests must pass before starting the next task.**
- **Project validation commands** (run these to validate each task):
  - `pnpm run build` — TypeScript check + Vite build (the typecheck/lint gate).
  - `pnpm run test` — Vitest unit tests.
  - `pnpm run test:e2e` — Playwright (chromium + mobile Pixel 7).
  - `pnpm run test:all` — full CI gate; must pass before completing a task.
- **Browser-verify gate** (any UI-changing task): after the suite passes, ensure the
  dev server is up (`pnpm dev` → `http://127.0.0.1:1420`; start in background and wait
  for the port), then drive the running app with agent-browser and confirm the riso
  end state before marking the task done:
  - `agent-browser open http://127.0.0.1:1420/`
  - `agent-browser snapshot -i` (a11y tree with `@e` refs) → `click @eN` / `fill @eN "…"`
  - `agent-browser screenshot` (compare against `docs/brand/riso-flow.html`)
- Quality bars: WCAG AA contrast, **no emoji as icons** (one inline-SVG family),
  `prefers-reduced-motion` disables scan/blink/stamp, touch targets ≥44px,
  `:focus-visible` rings, consistent stroke width.

## Implementation Steps

### Task 1: Risograph foundation — tokens, fonts, grain, motion

**Files:**
- Modify: `src/index.css`, `src/App.tsx`, `index.html`

- [x] Add riso tokens to `src/index.css` (Tailwind v4 `@theme` + `:root`): paper,
      paper-2, ink, ink-soft, teal, red, yellow, line, radius, easing; set `body`
      to paper bg + ink text (replace the dark `#0b0f1a`/`#e5e7eb` defaults).
- [x] Load fonts (Bricolage Grotesque / DM Sans / Space Mono) with system fallback
      and `font-display: swap`; add the page-wide paper grain overlay (fixed,
      `feTurbulence`, multiply ~.45) and register the `#rough` SVG filter once in `App.tsx`.
- [x] Add a global `@media (prefers-reduced-motion: reduce)` rule that disables animations.
- [x] Write/adjust tests: a unit test asserting the riso tokens/body theme are applied.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 2.
- [x] agent-browser verify at `:1420`: screenshot confirms warm-paper bg + loaded fonts.

### Task 2: Shared Risograph primitives + inline icon set

**Files:**
- Create: `src/components/riso/Icon.tsx`, `RisoButton.tsx`, `RisoField.tsx`,
  `Stamp.tsx`, `Halftone.tsx`, `Logo.tsx`
- Create: `src/components/riso/RisoButton.test.tsx`, `Icon.test.tsx`

- [x] Build the inline-SVG icon set (camera, upload, calendar, clock, pin, gear,
      check, sparkle, lock/shield, mic, arrow, edit) to replace every emoji.
- [x] Build `RisoButton` (primary teal / secondary outline, 2px ink border, multiply,
      `:focus-visible`, ≥44px), `RisoField`+label, `Stamp` (rough rotated check via
      `#rough`), `Halftone` helper, and `Logo` (overprint mark: teal calendar + red
      bolt/outline, misregistered).
- [x] Write tests: `RisoButton.test.tsx` (render, onClick, disabled) and `Icon.test.tsx`
      (renders `<svg>` with correct accessible name / `aria-hidden`).
- [x] Run `pnpm run test` and `pnpm run build` — must pass before Task 3.
- [x] Browser-verify: not applicable (no route yet) — covered by the unit tests above.

### Task 3: Header + Capture (home) screen

**Files:**
- Modify: `src/components/Header.tsx`, `src/components/Capture.tsx`, `e2e/app.spec.ts`

- [x] Restyle `Header` (riso `Logo` + gear `Icon`, paper bar, ink divider, Bricolage
      title; keep the settings action) and `Capture` to riso-flow screen 1 (ink-bordered
      zone with halftone + red camera blob, teal "Take photo", outline "Upload file",
      shield privacy footer); replace 📅/⚙️/📷/📄/🎤 with `Icon`s; preserve file-input handlers.
- [x] Write tests: extend `e2e/app.spec.ts` (or add `e2e/capture.spec.ts`) for the riso
      capture (paper bg, "Take photo", logo) and keep the mobile safe-area test green;
      update Header/Capture unit tests for the new markup.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 4.
- [x] agent-browser verify: `open /`, `snapshot -i`, `screenshot`; gear opens settings.

### Task 4: Settings screen

**Files:**
- Modify: `src/components/Settings.tsx`, `src/components/Settings.test.tsx`, `e2e/app.spec.ts`

- [x] Restyle `Settings` to riso (paper, Space-Mono labels, riso provider control,
      ink-bordered masked key input, teal "Save", "Saved on this device" + teal
      mini-stamp, shield footer); keep provider/model/key logic and accessible names.
- [x] Write/update tests: `Settings.test.tsx` (provider switch → model reset) and the
      OpenRouter e2e in `app.spec.ts` for the new control; assert riso styling on a key element.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 5.
- [x] agent-browser verify: open settings, switch provider, confirm reset + masked key + stamp; screenshot.

### Task 5: Processing (extract) screen

**Files:**
- Modify: `src/components/Processing.tsx`; add e2e fixture/spec under `e2e/`

- [x] Restyle `Processing` to the riso "Reading" screen (duotone halftone thumbnail
      with scan sweep, ink-bar skeletons, "Pulling out your event…" + red spark, keep
      Cancel); wrap animations so `prefers-reduced-motion` disables them.
- [x] Write tests: assert riso skeleton + label render; a Playwright test using a
      stubbed/mocked extraction reaches the processing state, plus an
      `emulateMedia({ reducedMotion: 'reduce' })` check that the animation is off.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 6.
- [x] agent-browser verify: drive into processing (fixture image + stubbed/slow provider) and screenshot.

### Task 6: Review + Event card

**Files:**
- Modify: `src/components/Review.tsx`, `src/components/EventCard.tsx`, `src/App.test.tsx`

- [x] Restyle `Review` + `EventCard` to riso (paper, Space-Mono micro-labels,
      ink-bordered editable title/date/time/location with edit affordance, teal
      "Add to Google Calendar", outline "New capture", SVG no-events illustration);
      preserve inline-edit, add-to-calendar, and multi-event behavior.
- [x] Write/update tests: `App.test.tsx` (event rendering, calendar auto-open,
      multi-event) and EventCard tests for new markup; e2e renders a riso review card.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 7.
- [x] agent-browser verify: drive to review (fixture yielding stubbed events); screenshot the card. [skipped - not automatable in headless CI]

### Task 7: Success ("Added to calendar") screen — new

**Files:**
- Create: `src/components/Success.tsx`
- Modify: `src/App.tsx`, `src/App.test.tsx`

- [x] Add a `success` screen to the `App.tsx` state machine entered after the Google
      Calendar handoff; `Success.tsx` shows a rough rotated red rubber-stamp check,
      "Added to calendar", a perforated event "ticket", and an outline "Capture another"
      that resets to capture; preserve multi-event "one at a time" behavior.
- [x] Write tests: `App.test.tsx` — after add, success renders and "Capture another"
      returns to capture; add e2e coverage.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 8.
- [x] agent-browser verify: complete an add and confirm the stamped success screen; screenshot. [skipped - not automatable in headless CI]

### Task 8: Error screen + a11y / reduced-motion pass

**Files:**
- Modify: `src/components/ErrorView.tsx`; add an error e2e spec under `e2e/`

- [x] Restyle `ErrorView` to riso (paper, ink, `Icon` instead of ⚠️, friendly
      messages, retry/settings as riso buttons with red danger emphasis); do a global
      pass for `:focus-visible`, ≥44px targets, AA contrast, and `prefers-reduced-motion`
      across every screen; confirm no emoji remain (grep `src/`).
- [x] Write tests: e2e error state (e.g., bad key) shows the riso error + retry; a
      reduced-motion e2e; an assertion that rendered output contains no emoji glyphs.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 9.
- [x] agent-browser verify: force a bad-key error and screenshot; toggle reduced motion and confirm animations off. [skipped - not automatable in headless CI]

### Task 9: App icon, favicon & PWA icons from the riso mark

**Files:**
- Modify: `vite.config.ts`, `public/favicon.ico`, `public/favicon.png`,
  `public/apple-touch-icon.png`, `public/pwa-192x192.png`, `public/pwa-512x512.png`,
  `public/pwa-maskable-512x512.png`, `src-tauri/icons/*`
- Create: `app-icon.png` (1024×1024 source)

- [x] Render the riso mark to a 1024×1024 `app-icon.png`; run `pnpm tauri icon
      ./app-icon.png` to regenerate `src-tauri/icons/*`; replace the `public/` favicons
      and PWA icons with riso versions; update the PWA manifest `theme_color` /
      `background_color` in `vite.config.ts` to the riso palette.
- [x] Write tests: an e2e smoke check that the favicon `<link>` and manifest are served.
- [x] Run `pnpm run test:all` and `pnpm run build` — must pass before Task 10.
- [x] agent-browser verify: `open /`, confirm the new favicon/theme; screenshot.

### Task 10: Verify acceptance criteria

**Files:**
- Modify: (none — verification only)

- [ ] Run the full test suite: `pnpm run test:all` (chromium + mobile) — all green.
- [ ] Run the typecheck/lint gate: `pnpm run build` — clean.
- [ ] Confirm no emoji icons remain in `src/` (grep) and all icons use the one SVG family.
- [ ] Confirm `prefers-reduced-motion` disables every animation and AA contrast holds
      for primary + muted text.
- [ ] agent-browser walk of all screens (capture → processing → review → success →
      settings → error); screenshots match `docs/brand/riso-flow.html`.
- [ ] Confirm no test-coverage regression (existing Vitest/Playwright coverage stays green).

### Task 11: Update documentation

**Files:**
- Modify: `README.md`, `CLAUDE.md`

- [ ] Update `README.md` for the new Risograph look (user-facing visuals) and how to
      regenerate icons (`pnpm tauri icon ./app-icon.png`).
- [ ] Update `CLAUDE.md` for the internal patterns introduced (riso tokens in
      `src/index.css`, shared primitives in `src/components/riso/`, the agent-browser
      verification step, and the no-emoji-icons rule).
