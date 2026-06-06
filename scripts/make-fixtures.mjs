// Generates the test fixtures used by the live extraction tests:
//   src/test/fixtures/sample-event.pdf  — a single-page text PDF describing one event
//   src/test/fixtures/sample-event.png  — a rasterised image of that same page
//
// Run once locally (the outputs are committed so CI needs no PDF tooling):
//   node scripts/make-fixtures.mjs
//
// PNG rasterisation prefers `pdftoppm` (poppler) and falls back to macOS `sips`.

import { writeFileSync, existsSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "src", "test", "fixtures");
const pdfPath = join(fixturesDir, "sample-event.pdf");
const pngPath = join(fixturesDir, "sample-event.png");

// Lines printed top-to-bottom on the page. Keep these in sync with the
// expectations in src/test/integration/live.test.ts (EXPECTED_EVENT).
const LINES = [
  "Calendrino Team Kickoff",
  "",
  "Date: Friday, March 13, 2026",
  "Time: 2:30 PM to 3:30 PM",
  "Location: Berlin Office, Room 4B",
  "",
  "Quarterly planning session for the Calendrino launch.",
];

function escapePdfText(s) {
  return s.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");
}

function buildContentStream() {
  // Helvetica 16pt, 22pt leading, starting near the top of an A4-ish page.
  let body = "BT\n/F1 16 Tf\n22 TL\n72 720 Td\n";
  LINES.forEach((line, i) => {
    if (i > 0) body += "T*\n";
    body += `(${escapePdfText(line)}) Tj\n`;
  });
  body += "ET";
  return body;
}

function buildPdf() {
  const content = buildContentStream();
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  const header = "%PDF-1.4\n";
  let body = "";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(header.length + body.length);
    body += `${i + 1} 0 obj\n${obj}\nendobj\n`;
  });

  const xrefStart = header.length + body.length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (const off of offsets) {
    xref += `${String(off).padStart(10, "0")} 00000 n \n`;
  }
  const trailer = `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF\n`;

  return Buffer.from(header + body + xref + trailer, "latin1");
}

function rasterise() {
  // pdftoppm writes "<prefix>.png"; emit straight to the fixture path.
  try {
    execFileSync("pdftoppm", ["-png", "-r", "150", "-singlefile", pdfPath, pngPath.replace(/\.png$/, "")]);
    if (existsSync(pngPath)) return "pdftoppm";
  } catch {
    /* fall through to sips */
  }
  execFileSync("sips", ["-s", "format", "png", pdfPath, "--out", pngPath]);
  return "sips";
}

writeFileSync(pdfPath, buildPdf());
const tool = rasterise();
console.log(`Wrote ${pdfPath}`);
console.log(`Wrote ${pngPath} (via ${tool})`);
