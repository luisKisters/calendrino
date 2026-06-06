import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractEventsDirect } from "./aiCore";

const mocks = vi.hoisted(() => ({
  generateObject: vi.fn(async () => ({ object: { events: [] } })),
  createGoogleGenerativeAI: vi.fn(() => vi.fn((model: string) => ({ provider: "gemini", model }))),
  createAnthropic: vi.fn(() => vi.fn((model: string) => ({ provider: "anthropic", model }))),
  createOpenAI: vi.fn(() => vi.fn((model: string) => ({ provider: "openai", model }))),
  createOpenAICompatible: vi.fn(() => vi.fn((model: string) => ({ provider: "openrouter", model }))),
}));

vi.mock("ai", () => ({ generateObject: mocks.generateObject }));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: mocks.createGoogleGenerativeAI }));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: mocks.createAnthropic }));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: mocks.createOpenAI }));
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: mocks.createOpenAICompatible }));

const baseInput = {
  bytes: new Uint8Array([1, 2, 3]),
  mediaType: "image/png",
  apiKey: "key",
  now: { isoDate: "2026-06-06", weekday: "Saturday", tz: "Europe/Berlin" },
  fetch: vi.fn(),
} as const;

describe("extractEventsDirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("uses OpenAI provider with the selected model", async () => {
    await extractEventsDirect({ ...baseInput, provider: "openai", model: "gpt-4.1" });

    expect(mocks.createOpenAI).toHaveBeenCalledWith(expect.objectContaining({ apiKey: "key", fetch: baseInput.fetch }));
    expect(mocks.generateObject).toHaveBeenCalledWith(expect.objectContaining({ model: { provider: "openai", model: "gpt-4.1" } }));
  });

  it("uses OpenRouter's default Kimi model when no override is set", async () => {
    await extractEventsDirect({ ...baseInput, provider: "openrouter" });

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "openrouter",
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: "key",
        fetch: baseInput.fetch,
      }),
    );
    expect(mocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ model: { provider: "openrouter", model: "moonshotai/kimi-k2.6" } }),
    );
  });

  it("rejects unsupported PDFs before calling a provider", async () => {
    await expect(extractEventsDirect({ ...baseInput, provider: "anthropic", mediaType: "application/pdf" })).rejects.toThrow(
      "does not support PDFs",
    );

    expect(mocks.createAnthropic).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });

  // Regression: native (Tauri) Anthropic calls 500'd with a CORS error because
  // the API blocks browser-origin requests unless this header opts in.
  it("opts Anthropic into direct browser access to avoid the CORS 500", async () => {
    await extractEventsDirect({ ...baseInput, provider: "anthropic", model: "claude-haiku-4-5" });

    expect(mocks.createAnthropic).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "key",
        headers: expect.objectContaining({ "anthropic-dangerous-direct-browser-access": "true" }),
      }),
    );
  });

  it("routes Weights & Biases through its OpenAI-compatible Kimi endpoint", async () => {
    await extractEventsDirect({ ...baseInput, provider: "wandb" });

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "wandb",
        baseURL: "https://api.inference.wandb.ai/v1",
        apiKey: "key",
        fetch: baseInput.fetch,
      }),
    );
    expect(mocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({ model: { provider: "openrouter", model: "moonshotai/Kimi-K2.6" } }),
    );
  });

  it("uses DeepSeek v4-flash with thinking disabled for minimal reasoning", async () => {
    // DeepSeek is text-only, so exercise the wiring with a non-image media type
    // (the image/PDF media gate is covered by its own test).
    await extractEventsDirect({ ...baseInput, provider: "deepseek", mediaType: "text/plain" });

    expect(mocks.createOpenAICompatible).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "deepseek",
        baseURL: "https://api.deepseek.com/v1",
        apiKey: "key",
      }),
    );
    expect(mocks.generateObject).toHaveBeenCalledWith(
      expect.objectContaining({
        model: { provider: "openrouter", model: "deepseek-v4-flash" },
        providerOptions: { deepseek: { thinking: { type: "disabled" } } },
      }),
    );
  });
});
