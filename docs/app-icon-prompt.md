# Calendrino — App Icon Prompt

Concept: Calendrino turns a **photo / screenshot / PDF** into a **calendar event**.
The icon should fuse a **calendar** with a **capture** cue (camera aperture/lens)
and a subtle **AI sparkle**. Brand color is indigo→violet (matches the app UI).

## Primary prompt (copy–paste)

> App icon for "Calendrino", a smart app that turns a photo or document into a
> calendar event. A clean, modern, minimalist icon centered on a single bold
> glyph that fuses a **calendar page** with a **camera aperture/lens**, plus a
> small **AI sparkle**. Flat vector style with soft depth (subtle inner highlight
> and long shadow). Background: smooth diagonal gradient from indigo **#6366F1**
> to violet **#8B5CF6** on a rounded-square (squircle) tile. Foreground glyph in
> crisp white with a hint of light-blue accent. Geometric, balanced, high
> contrast, instantly readable at 48px, generous safe-area padding. No text, no
> letters, no numbers, no photographic elements. 1024×1024, centered,
> app-store quality, sharp edges.

## Variants to try

- **A — Shutter calendar:** "…a calendar page whose top binding row becomes a
  camera shutter; one date cell glows with a sparkle…"
- **B — Line-art badge:** "…minimal white line-art of a calendar with a small
  spark/checkmark, on a solid deep-indigo squircle, ultra-clean, lots of
  negative space…"
- **C — Glossy 3D:** "…glossy 3D calendar tile with a soft lens flare and depth,
  Apple-style, premium, subtle reflections…"

## Constraints / negative prompt

`no text, no words, no letters, no numbers, no realistic photos, not busy, no
clutter, no thin strokes that disappear when small, no hard drop shadow on a
transparent background`

## Output you want

- **1024×1024 PNG.**
- One version **with the gradient background** (for iOS / desktop / store).
- Optional: a **transparent-background** version with the glyph inside the central
  ~66% "safe zone" (for Android adaptive icons).

## Apply it to the app (one command)

Once you have a 1024×1024 PNG (e.g. `app-icon.png` in the project root):

```bash
npm run tauri icon ./app-icon.png
```

This regenerates every platform icon into `src-tauri/icons/` (32/128/@2x,
`icon.icns`, `icon.ico`, Android `mipmap-*`, iOS asset set). Commit the result.
Tip: use an RGBA PNG so the rounded-corner/adaptive masks render cleanly.

## Tools

Works as-is in Gemini ("Nano Banana"/image), DALL·E, Midjourney, Ideogram, or
Canva. For Midjourney, append `--ar 1:1 --style raw`.
