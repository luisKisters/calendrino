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
      "Use Gemini or OpenRouter for PDFs",
    );

    expect(mocks.createAnthropic).not.toHaveBeenCalled();
    expect(mocks.generateObject).not.toHaveBeenCalled();
  });
});
