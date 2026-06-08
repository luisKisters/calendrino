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

    await user.click(screen.getByRole("radio", { name: "OpenRouter" }));
    expect(screen.getByLabelText("OpenRouter API key")).toBeInTheDocument();
    expect(screen.getByLabelText("Model")).toHaveValue("moonshotai/kimi-k2.6");

    await user.clear(screen.getByLabelText("Model"));
    await user.type(screen.getByLabelText("Model"), "openai/gpt-4.1");
    await user.type(screen.getByLabelText("OpenRouter API key"), "sk-or-test");
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith({
      selectedProvider: "openrouter",
      providers: {
        openrouter: { apiKey: "sk-or-test", model: "openai/gpt-4.1" },
      },
    });
  });

  it("saves typed and preset custom instructions", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn();

    render(
      <Settings
        initialSettings={{ selectedProvider: "gemini", providers: { gemini: { apiKey: "AIza-x" } } }}
        hasExistingKey
        onSave={onSave}
      />,
    );

    await user.type(screen.getByLabelText(/Custom instructions/i), "Titles in English.");
    await user.click(screen.getByRole("button", { name: /Assume the Europe\/Berlin timezone/i }));
    await user.click(screen.getByRole("button", { name: "Save" }));

    expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({
        customInstructions: "Titles in English.\nAssume the Europe/Berlin timezone.",
      }),
    );
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

  it("shows saved stamp after save", async () => {
    const user = userEvent.setup();
    const onSave = vi.fn().mockResolvedValue(undefined);

    render(
      <Settings
        initialSettings={{
          selectedProvider: "gemini",
          providers: { gemini: { apiKey: "test-key", model: "gemini-2.0-flash" } },
        }}
        hasExistingKey
        onSave={onSave}
      />,
    );

    expect(screen.queryByText(/Saved on this device/)).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Save" }));
    expect(await screen.findByText(/Saved on this device/)).toBeInTheDocument();
  });

  it("renders riso styling — ink border on API key field", () => {
    render(
      <Settings
        initialSettings={{ selectedProvider: "gemini", providers: {} }}
        hasExistingKey={false}
        onSave={vi.fn()}
      />,
    );

    const keyInput = screen.getByLabelText(/API key/i);
    const wrapper = keyInput.closest("div");
    expect(wrapper?.className).toContain("border-ink");
  });
});
