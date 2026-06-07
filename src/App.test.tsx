import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";

const mocks = vi.hoisted(() => ({
  getAiSettings: vi.fn(),
  setAiSettings: vi.fn(),
  extractEvents: vi.fn(),
  openExternal: vi.fn(),
}));

vi.mock("./lib/store", async () => {
  const actual = await vi.importActual<typeof import("./lib/store")>("./lib/store");
  return {
    ...actual,
    getAiSettings: mocks.getAiSettings,
    setAiSettings: mocks.setAiSettings,
  };
});
vi.mock("./lib/ai", () => ({ extractEvents: mocks.extractEvents }));
vi.mock("./lib/platform", () => ({
  isTauri: () => false,
  aiFetch: fetch,
  openExternal: mocks.openExternal,
}));

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAiSettings.mockResolvedValue({ selectedProvider: "gemini", providers: {} });
    mocks.setAiSettings.mockResolvedValue(undefined);
    mocks.extractEvents.mockResolvedValue([
      {
        title: "Board meeting",
        start: "2026-06-10T09:00:00",
        end: null,
        allDay: false,
        location: null,
        description: null,
        timezone: null,
        confidence: 0.9,
      },
    ]);
  });

  it("starts in settings without a saved key", async () => {
    render(<App />);

    expect(await screen.findByText("Welcome to Calendrino")).toBeInTheDocument();
  });

  it("starts in capture with a saved key", async () => {
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
    });

    render(<App />);

    expect(await screen.findByText("Capture an event")).toBeInTheDocument();
  });

  it("shows an unsupported PDF error for OpenAI", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
    });

    const { container } = render(<App />);
    await screen.findByText("Capture an event");

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["%PDF"], "event.pdf", { type: "application/pdf" }));

    expect(await screen.findByText("PDFs are not supported for this provider")).toBeInTheDocument();
    expect(mocks.extractEvents).not.toHaveBeenCalled();
  });

  it("uploads an image and renders extracted events", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });

    const { container } = render(<App />);
    await screen.findByText("Capture an event");

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.extractEvents).toHaveBeenCalledWith(expect.objectContaining({ provider: "openrouter" })));
    expect(await screen.findByDisplayValue("Board meeting")).toBeInTheDocument();
  });

  it("opens Google Calendar immediately when exactly one event is extracted", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });

    const { container } = render(<App />);
    await screen.findByText("Capture an event");

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() =>
      expect(mocks.openExternal).toHaveBeenCalledWith(expect.stringContaining("calendar.google.com")),
    );
    // Still lands on review as a fallback (e.g. if a popup blocker swallows the open).
    expect(await screen.findByDisplayValue("Board meeting")).toBeInTheDocument();
  });

  it("renders the #rough SVG filter for riso stamp effects", async () => {
    render(<App />);
    // Wait for initial load
    await screen.findByText("Welcome to Calendrino");
    const filter = document.getElementById("rough");
    expect(filter).not.toBeNull();
    expect(filter?.tagName.toLowerCase()).toBe("filter");
  });

  it("does not auto-open the calendar when multiple events are extracted", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });
    mocks.extractEvents.mockResolvedValue([
      { title: "Standup", start: "2026-06-10T09:00:00", end: "2026-06-10T09:30:00", allDay: false, location: null, description: null, timezone: null, confidence: 0.9 },
      { title: "Lunch", start: "2026-06-10T12:00:00", end: "2026-06-10T13:00:00", allDay: false, location: null, description: null, timezone: null, confidence: 0.8 },
    ]);

    const { container } = render(<App />);
    await screen.findByText("Capture an event");

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    expect(await screen.findByText("2 events found")).toBeInTheDocument();
    expect(mocks.openExternal).not.toHaveBeenCalled();
  });
});
