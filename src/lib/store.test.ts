import { beforeEach, describe, expect, it } from "vitest";
import { getAiSettings, setAiSettings } from "./store";

describe("AI settings store", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("returns empty Gemini settings by default", async () => {
    await expect(getAiSettings()).resolves.toEqual({ selectedProvider: "gemini", providers: {} });
  });

  it("persists model overrides", async () => {
    await setAiSettings({
      selectedProvider: "openrouter",
      providers: {
        openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" },
      },
    });

    await expect(getAiSettings()).resolves.toEqual({
      selectedProvider: "openrouter",
      providers: {
        openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" },
      },
    });
  });

  it("migrates the legacy Gemini API key", async () => {
    localStorage.setItem("geminiApiKey", "AIza-legacy");

    await expect(getAiSettings()).resolves.toEqual({
      selectedProvider: "gemini",
      providers: {
        gemini: { apiKey: "AIza-legacy" },
      },
    });
  });
});
