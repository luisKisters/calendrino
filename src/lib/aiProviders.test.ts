import { describe, expect, it } from "vitest";
import { AI_PROVIDERS } from "./aiProviders";

describe("AI_PROVIDERS", () => {
  it("configures the four supported providers", () => {
    expect(Object.keys(AI_PROVIDERS)).toEqual(["gemini", "anthropic", "openai", "openrouter"]);
  });

  it("uses Kimi K2.6 as the editable OpenRouter default", () => {
    expect(AI_PROVIDERS.openrouter.defaultModel).toBe("moonshotai/kimi-k2.6");
  });

  it("tracks default PDF capability by provider", () => {
    expect(AI_PROVIDERS.gemini.supportsPdfs).toBe(true);
    expect(AI_PROVIDERS.openrouter.supportsPdfs).toBe(true);
    expect(AI_PROVIDERS.anthropic.supportsPdfs).toBe(false);
    expect(AI_PROVIDERS.openai.supportsPdfs).toBe(false);
  });
});
