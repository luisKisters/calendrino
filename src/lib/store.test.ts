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

  it("persists optional custom instructions", async () => {
    await setAiSettings({
      selectedProvider: "gemini",
      providers: { gemini: { apiKey: "AIza-test" } },
      customInstructions: "Assume Europe/Berlin.",
    });

    await expect(getAiSettings()).resolves.toEqual({
      selectedProvider: "gemini",
      providers: { gemini: { apiKey: "AIza-test" } },
      customInstructions: "Assume Europe/Berlin.",
    });
  });

  it("drops blank custom instructions", async () => {
    await setAiSettings({
      selectedProvider: "gemini",
      providers: { gemini: { apiKey: "AIza-test" } },
      customInstructions: "   ",
    });

    const settings = await getAiSettings();
    expect(settings.customInstructions).toBeUndefined();
  });

  it("ignores non-string custom instructions from saved settings", async () => {
    localStorage.setItem(
      "aiSettings.v1",
      JSON.stringify({
        selectedProvider: "gemini",
        providers: { gemini: { apiKey: "AIza-test" } },
        customInstructions: 123,
      }),
    );

    const settings = await getAiSettings();
    expect(settings.customInstructions).toBeUndefined();
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
