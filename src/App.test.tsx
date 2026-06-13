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

    expect(await screen.findByRole("button", { name: /take photo/i })).toBeInTheDocument();
  });

  it("sends a PDF capture through extraction (every provider handles PDFs now)", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["%PDF"], "event.pdf", { type: "application/pdf" }));

    await waitFor(() =>
      expect(mocks.extractEvents).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "openai", mediaType: "application/pdf" }),
      ),
    );
    expect(await screen.findByDisplayValue("Board meeting")).toBeInTheDocument();
  });

  it("forwards saved custom instructions to extraction", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      customInstructions: "Assume Europe/Berlin.",
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() =>
      expect(mocks.extractEvents).toHaveBeenCalledWith(
        expect.objectContaining({ instructions: "Assume Europe/Berlin." }),
      ),
    );
  });

  it("uploads an image and renders extracted events", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

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
    await screen.findByRole("button", { name: /take photo/i });

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
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    expect(await screen.findByText("2 events found")).toBeInTheDocument();
    expect(mocks.openExternal).not.toHaveBeenCalled();
  });

  it("review screen shows riso event card with testid", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.extractEvents).toHaveBeenCalled());
    const card = await screen.findByTestId("riso-event-card");
    expect(card).toBeInTheDocument();
    expect(await screen.findByRole("heading", { name: /review event/i })).toBeInTheDocument();
  });

  it("review screen New capture button returns to capture", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.extractEvents).toHaveBeenCalled());
    await screen.findByTestId("riso-event-card");

    await user.click(screen.getByRole("button", { name: /new capture/i }));
    expect(await screen.findByRole("button", { name: /take photo/i })).toBeInTheDocument();
  });

  it("success screen shows after adding an event from review", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.extractEvents).toHaveBeenCalled());
    const addBtn = await screen.findByRole("button", { name: /add to google calendar/i });
    await user.click(addBtn);

    expect(await screen.findByRole("heading", { name: /added to calendar/i })).toBeInTheDocument();
    expect(screen.getByTestId("success-ticket")).toBeInTheDocument();
  });

  it("success screen Capture another returns to capture", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.extractEvents).toHaveBeenCalled());
    const addBtn = await screen.findByRole("button", { name: /add to google calendar/i });
    await user.click(addBtn);

    await screen.findByRole("heading", { name: /added to calendar/i });
    await user.click(screen.getByRole("button", { name: /capture another/i }));

    expect(await screen.findByRole("button", { name: /take photo/i })).toBeInTheDocument();
  });

  it("multi-event review stays on review after adding one event", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });
    mocks.extractEvents.mockResolvedValue([
      { title: "Standup", start: "2026-06-10T09:00:00", end: null, allDay: false, location: null, description: null, timezone: null, confidence: 0.9 },
      { title: "Lunch", start: "2026-06-10T12:00:00", end: null, allDay: false, location: null, description: null, timezone: null, confidence: 0.8 },
    ]);

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await screen.findByText("2 events found");
    const addBtns = await screen.findAllByRole("button", { name: /add to google calendar/i });
    await user.click(addBtns[0]);

    // Review screen still visible — second event remains accessible.
    expect(screen.queryByRole("heading", { name: /added to calendar/i })).not.toBeInTheDocument();
    expect(screen.getByText("2 events found")).toBeInTheDocument();
  });

  it("review screen Add to Google Calendar button calls openExternal", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });
    // Use two events so auto-open does not fire (auto-open only fires for exactly one event)
    mocks.extractEvents.mockResolvedValue([
      { title: "Standup", start: "2026-06-10T09:00:00", end: null, allDay: false, location: null, description: null, timezone: null, confidence: 0.9 },
      { title: "Lunch", start: "2026-06-10T12:00:00", end: null, allDay: false, location: null, description: null, timezone: null, confidence: 0.8 },
    ]);

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.extractEvents).toHaveBeenCalled());
    const addBtns = await screen.findAllByRole("button", { name: /add to google calendar/i });
    expect(addBtns[0]).toBeInTheDocument();

    await user.click(addBtns[0]);
    // openExternal called exactly once — from the button click, not auto-open
    expect(mocks.openExternal).toHaveBeenCalledTimes(1);
    expect(mocks.openExternal).toHaveBeenCalledWith(expect.stringContaining("calendar.google.com"));
  });
});
