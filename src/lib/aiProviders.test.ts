import { describe, expect, it } from "vitest";
import { AI_PROVIDERS } from "./aiProviders";

describe("AI_PROVIDERS", () => {
  it("configures the six supported providers", () => {
    expect(Object.keys(AI_PROVIDERS)).toEqual([
      "gemini",
      "anthropic",
      "openai",
      "openrouter",
      "wandb",
      "deepseek",
    ]);
  });

  it("uses Kimi K2.6 as the editable OpenRouter default", () => {
    expect(AI_PROVIDERS.openrouter.defaultModel).toBe("moonshotai/kimi-k2.6");
  });

  it("serves Kimi via Weights & Biases as the faster alternative to OpenRouter", () => {
    expect(AI_PROVIDERS.wandb.defaultModel).toBe("moonshotai/Kimi-K2.6");
    expect(AI_PROVIDERS.wandb.supportsImages).toBe(true);
    expect(AI_PROVIDERS.wandb.supportsPdfs).toBe(true);
  });

  it("defaults DeepSeek to the fast v4-flash model and marks it text-only", () => {
    expect(AI_PROVIDERS.deepseek.defaultModel).toBe("deepseek-v4-flash");
    // deepseek-v4-flash rejects image/file message parts, so captures are unsupported.
    expect(AI_PROVIDERS.deepseek.supportsImages).toBe(false);
    expect(AI_PROVIDERS.deepseek.supportsPdfs).toBe(false);
  });

  it("tracks default PDF capability by provider", () => {
    expect(AI_PROVIDERS.gemini.supportsPdfs).toBe(true);
    expect(AI_PROVIDERS.openrouter.supportsPdfs).toBe(true);
    expect(AI_PROVIDERS.wandb.supportsPdfs).toBe(true);
    expect(AI_PROVIDERS.anthropic.supportsPdfs).toBe(false);
    expect(AI_PROVIDERS.openai.supportsPdfs).toBe(false);
    expect(AI_PROVIDERS.deepseek.supportsPdfs).toBe(false);
  });
});
