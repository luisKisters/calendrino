// @vitest-environment node
//
// Runs the REAL pdf-text extraction (unpdf, no mocks, no network) against the
// committed Probenplan fixture, so the DeepSeek PDF->text path is verified in CI
// and locally without any API keys. The key-gated live tests then confirm the
// extracted text actually yields events from the model.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { EXTRACTED_TEXT_MEDIA_TYPE, prepareMediaForProvider } from "../../lib/mediaPrep";

const here = dirname(fileURLToPath(import.meta.url));
const probenplan = new Uint8Array(readFileSync(join(here, "..", "fixtures", "probenplan.pdf")));

describe("prepareMediaForProvider on the real Probenplan PDF", () => {
  it("reduces the PDF to its text layer for text-only DeepSeek", async () => {
    const result = await prepareMediaForProvider({
      bytes: probenplan,
      mediaType: "application/pdf",
      provider: "deepseek",
    });

    expect(result.mediaType).toBe(EXTRACTED_TEXT_MEDIA_TYPE);
    const text = new TextDecoder().decode(result.bytes);
    expect(text).toContain("Probenplan");
    expect(text.length).toBeGreaterThan(500);
  });

  it("passes the PDF through untouched for a PDF-native provider", async () => {
    const result = await prepareMediaForProvider({
      bytes: probenplan,
      mediaType: "application/pdf",
      provider: "gemini",
    });

    expect(result.mediaType).toBe("application/pdf");
    expect(result.bytes).toBe(probenplan);
  });
});
