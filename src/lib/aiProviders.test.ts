import { describe, expect, it } from "vitest";
import { AI_PROVIDERS } from "./aiProviders";

describe("AI_PROVIDERS", () => {
  it("configures the five supported providers (W&B is an OpenRouter upstream, not a provider)", () => {
    expect(Object.keys(AI_PROVIDERS)).toEqual([
      "gemini",
      "anthropic",
      "openai",
      "openrouter",
      "deepseek",
    ]);
  });

  it("uses Kimi K2.6 as the editable OpenRouter default", () => {
    expect(AI_PROVIDERS.openrouter.defaultModel).toBe("moonshotai/kimi-k2.6");
  });

  it("defaults DeepSeek to the fast v4-flash model and marks it text-only", () => {
    expect(AI_PROVIDERS.deepseek.defaultModel).toBe("deepseek-v4-flash");
    // deepseek-v4-flash rejects image/file message parts, so captures are unsupported.
    expect(AI_PROVIDERS.deepseek.supportsImages).toBe(false);
    expect(AI_PROVIDERS.deepseek.supportsPdfs).toBe(false);
  });

  it("tracks native PDF capability by provider", () => {
    // Native = the provider reads PDFs directly. DeepSeek gains PDF support via
    // client-side text extraction instead.
    expect(AI_PROVIDERS.gemini.supportsPdfs).toBe(true);
    expect(AI_PROVIDERS.openrouter.supportsPdfs).toBe(true);
    expect(AI_PROVIDERS.anthropic.supportsPdfs).toBe(true);
    expect(AI_PROVIDERS.openai.supportsPdfs).toBe(true);
    // DeepSeek is text-only: PDFs reach it via client-side text extraction.
    expect(AI_PROVIDERS.deepseek.supportsPdfs).toBe(false);
  });
});
