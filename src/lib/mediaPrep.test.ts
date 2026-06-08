import { beforeEach, describe, expect, it, vi } from "vitest";
import { EXTRACTED_TEXT_MEDIA_TYPE, MediaPrepError, prepareMediaForProvider } from "./mediaPrep";

const mocks = vi.hoisted(() => ({
  extractText: vi.fn(async () => ({ totalPages: 1, text: "Montag 8:00 Probe" })),
  getDocumentProxy: vi.fn(async () => ({})),
}));

vi.mock("unpdf", () => ({
  extractText: mocks.extractText,
  getDocumentProxy: mocks.getDocumentProxy,
}));

const pdfBytes = new Uint8Array([1, 2, 3]);

describe("prepareMediaForProvider", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.extractText.mockResolvedValue({ totalPages: 1, text: "Montag 8:00 Probe" });
  });

  it("passes PDFs through untouched for providers that read them natively", async () => {
    for (const provider of ["gemini", "anthropic", "openai", "openrouter"] as const) {
      const result = await prepareMediaForProvider({ bytes: pdfBytes, mediaType: "application/pdf", provider });
      expect(result).toEqual({ bytes: pdfBytes, mediaType: "application/pdf" });
    }
    expect(mocks.extractText).not.toHaveBeenCalled();
  });

  it("extracts the text layer from a PDF for text-only DeepSeek", async () => {
    const result = await prepareMediaForProvider({ bytes: pdfBytes, mediaType: "application/pdf", provider: "deepseek" });

    expect(mocks.extractText).toHaveBeenCalledTimes(1);
    expect(result.mediaType).toBe(EXTRACTED_TEXT_MEDIA_TYPE);
    expect(new TextDecoder().decode(result.bytes)).toBe("Montag 8:00 Probe");
  });

  it("rejects a PDF with no extractable text layer", async () => {
    mocks.extractText.mockResolvedValueOnce({ totalPages: 1, text: "   " });

    await expect(
      prepareMediaForProvider({ bytes: pdfBytes, mediaType: "application/pdf", provider: "deepseek" }),
    ).rejects.toBeInstanceOf(MediaPrepError);
  });

  it("rejects images for a text-only provider (no OCR bundled)", async () => {
    await expect(
      prepareMediaForProvider({ bytes: pdfBytes, mediaType: "image/png", provider: "deepseek" }),
    ).rejects.toThrow(/can't read images/);
  });

  it("passes images through for image-capable providers", async () => {
    const result = await prepareMediaForProvider({ bytes: pdfBytes, mediaType: "image/png", provider: "openai" });
    expect(result).toEqual({ bytes: pdfBytes, mediaType: "image/png" });
  });
});
