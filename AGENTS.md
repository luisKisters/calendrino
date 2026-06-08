- New tests must be added to CI by installing the required test browsers after dependency installation and running `pnpm run test:all` before build steps.

## Riso design system

### Tokens
Design tokens live in the `@theme` block at the top of `src/index.css` (Tailwind v4
`@theme` + `:root`). The key variables: `--color-paper` (#F3E9D2), `--color-paper-2`
(#F8F1E0), `--color-ink` (#23201C), `--color-ink-soft` (#6A5E50), `--color-teal`
(#2A7E7B), `--color-red` (#F4502B), `--color-yellow` (#F5C84B), `--color-line`
(#C9BC9E). The paper grain overlay (fixed `feTurbulence` SVG, `mix-blend-mode:
multiply` ~0.45) and the `#rough` SVG filter are registered once in `App.tsx`.

### Shared primitives
All reusable riso UI lives in `src/components/riso/`:
- `Icon.tsx` — inline SVG icon set; use `<Icon name="..." />` (not emoji). Available
  names: camera, upload, calendar, clock, pin, gear, check, sparkle, shield, mic, arrow, edit.
- `RisoButton.tsx` — primary (teal fill) and secondary (ink outline) variants; 2px
  ink border, `mix-blend-mode: multiply`, `:focus-visible` ring, ≥44px touch target.
- `RisoField.tsx` — labeled text input with Space Mono label.
- `Stamp.tsx` — rubber-stamp check mark using the `#rough` SVG filter.
- `Halftone.tsx` — radial-gradient dot background helper.
- `Logo.tsx` — overprint mark: teal calendar + red outline, misregistered.

### No-emoji rule
Never use emoji as icons. Every icon in `src/` must come from `<Icon name="..." />`
(defined in `src/components/riso/Icon.tsx`). Verify with: `grep -r '📅\|⚙️\|📷\|📄\|🎤\|🤔\|⚠️' src/`.

### Animations
All CSS animations and transitions must be wrapped so they are disabled when
`prefers-reduced-motion: reduce` is active. A global rule in `src/index.css` covers
most cases; component-level keyframes must also respect it.

### Agent-browser verification
After any UI-changing task, verify the running app with agent-browser:
1. Start dev server in background: `pnpm dev` (waits for `http://127.0.0.1:1420`).
2. `agent-browser open http://127.0.0.1:1420/`
3. `agent-browser snapshot -i` — a11y tree with `@e` refs for click/fill.
4. `agent-browser screenshot` — compare against `docs/brand/riso-flow.html`.
The reference design is at `docs/brand/riso-flow.html`.
