import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Settings } from "./Settings";

vi.mock("../lib/platform", () => ({ openExternal: vi.fn() }));

describe("Settings", () => {
  it("switches providers and saves editable OpenRouter model", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <Settings
        initialSettings={{ selectedProvider: "gemini", providers: {} }}
        hasExistingKey={false}
        onSave={onSave}
      />,
    );

    await user.selectOptions(screen.getByLabelText("AI provider"), "openrouter");
    expect(screen.getByLabelText("OpenRouter API key")).toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toHaveValue("moonshotai/kimi-k2.6");

    await user.clear(screen.getByLabelText("Model"));
    await user.type(screen.getByLabelText("Model"), "openai/gpt-4.1");
    await user.type(screen.getByLabelText("OpenRouter API key"), "sk-or-test");
    await user.click(screen.getByRole("button", { name: "Save key" }));

    expect(onSave).toHaveBeenCalledWith({
      selectedProvider: "openrouter",
      providers: {
        openrouter: { apiKey: "sk-or-test", model: "openai/gpt-4.1" },
      },
    });
  });

  it("resets OpenRouter model to Kimi K2.6", async () => {
    const user = userEvent.setup();

    render(
      <Settings
        initialSettings={{
          selectedProvider: "openrouter",
          providers: { openrouter: { apiKey: "sk-or-test", model: "custom/model" } },
        }}
        hasExistingKey
        onSave={vi.fn()}
      />,
    );

    expect(screen.getByLabelText("Model")).toHaveValue("custom/model");
    await user.click(screen.getByRole("button", { name: "Reset to default" }));
    expect(screen.getByLabelText("Model")).toHaveValue("moonshotai/kimi-k2.6");
  });
});
