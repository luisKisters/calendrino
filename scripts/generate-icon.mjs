/**
 * Generates app-icon.png (1024×1024) using a headless browser to render
 * the riso mark SVG with correct mix-blend-mode overprint.
 */
import { chromium } from "@playwright/test";
import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, "..", "app-icon.png");

const html = `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: 1024px; height: 1024px; background: transparent; }
  .icon {
    width: 1024px;
    height: 1024px;
    background: #F3E9D2;
    border-radius: 180px;
    position: relative;
    display: flex;
    align-items: center;
    justify-content: center;
    overflow: hidden;
  }
  .layer {
    position: absolute;
    inset: 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  svg { mix-blend-mode: multiply; }
</style>
</head>
<body>
<div class="icon">
  <!-- teal layer -->
  <div class="layer">
    <svg viewBox="0 0 120 120" width="700" height="700"
         style="color:#2A7E7B; mix-blend-mode:multiply;">
      <rect x="22" y="32" width="76" height="74" rx="10" fill="currentColor"/>
      <path d="M64 46 L50 72 L60 72 L55 92 L73 64 L63 64 Z" fill="#F3E9D2"/>
    </svg>
  </div>
  <!-- red misregistered outline layer -->
  <div class="layer" style="transform: translate(22px, 18px) rotate(-2deg);">
    <svg viewBox="0 0 120 120" width="700" height="700"
         style="color:#F4502B; mix-blend-mode:multiply;">
      <rect x="22" y="32" width="76" height="74" rx="10"
            fill="none" stroke="currentColor" stroke-width="8"/>
    </svg>
  </div>
  <!-- calendar tabs (teal) -->
  <div class="layer">
    <svg viewBox="0 0 120 120" width="700" height="700"
         style="color:#2A7E7B; mix-blend-mode:multiply;">
      <rect x="40" y="24" width="12" height="18" rx="5" fill="currentColor"/>
      <rect x="68" y="24" width="12" height="18" rx="5" fill="currentColor"/>
    </svg>
  </div>
</div>
</body>
</html>`;

const browser = await chromium.launch();
const page = await browser.newPage();
await page.setViewportSize({ width: 1024, height: 1024 });
await page.setContent(html, { waitUntil: "networkidle" });
const screenshot = await page.screenshot({
  clip: { x: 0, y: 0, width: 1024, height: 1024 },
  omitBackground: false,
});
await browser.close();

writeFileSync(outPath, screenshot);
console.log("Generated:", outPath);
