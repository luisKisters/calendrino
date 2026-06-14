import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import App from "./App";
import type { CalendarEvent } from "./lib/schema";
import type { TranscriptChunk } from "./lib/transcript";

vi.setConfig({ testTimeout: 20_000 });

const mocks = vi.hoisted(() => ({
  getAiSettings: vi.fn(),
  setAiSettings: vi.fn(),
  streamExtraction: vi.fn(),
  imagePreviewUrl: vi.fn(),
  renderPdfFirstPage: vi.fn(),
  openExternal: vi.fn(),
}));

const originalRevokeObjectURL = URL.revokeObjectURL;

vi.mock("./lib/store", async () => {
  const actual = await vi.importActual<typeof import("./lib/store")>("./lib/store");
  return {
    ...actual,
    getAiSettings: mocks.getAiSettings,
    setAiSettings: mocks.setAiSettings,
  };
});
vi.mock("./lib/ai", () => ({ streamExtraction: mocks.streamExtraction }));
vi.mock("./lib/pdfPreview", () => ({
  imagePreviewUrl: mocks.imagePreviewUrl,
  renderPdfFirstPage: mocks.renderPdfFirstPage,
}));
vi.mock("./lib/platform", () => ({
  isTauri: () => false,
  aiFetch: fetch,
  openExternal: mocks.openExternal,
}));

function boardMeetingEvent(): CalendarEvent {
  return {
    title: "Board meeting",
    start: "2026-06-10T09:00:00",
    end: null,
    allDay: false,
    location: null,
    description: null,
    timezone: null,
    confidence: 0.9,
  };
}

function mockStreamEvents(events: CalendarEvent[], extraChunks: TranscriptChunk[] = []) {
  mocks.streamExtraction.mockImplementation(async function* () {
    yield { kind: "status", text: "Reading the capture." };
    for (const chunk of extraChunks) yield chunk;
    yield { kind: "done", events };
  });
}

function deferred<T = void>() {
  let resolve!: (value?: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((next) => {
    resolve = next as (value?: T | PromiseLike<T>) => void;
  });
  return { promise, resolve };
}

describe("App", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: vi.fn(),
    });
    mocks.getAiSettings.mockResolvedValue({ selectedProvider: "gemini", providers: {} });
    mocks.setAiSettings.mockResolvedValue(undefined);
    mocks.imagePreviewUrl.mockReturnValue("blob:preview");
    mocks.renderPdfFirstPage.mockResolvedValue("data:image/png;base64,pdf-preview");
    mockStreamEvents([boardMeetingEvent()]);
  });

  afterEach(() => {
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: originalRevokeObjectURL,
    });
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
      expect(mocks.streamExtraction).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "openai", mediaType: "application/pdf" }),
        expect.any(AbortSignal),
      ),
    );
    expect(mocks.renderPdfFirstPage).toHaveBeenCalledWith(expect.any(Uint8Array));
    expect(await screen.findByDisplayValue("Board meeting")).toBeInTheDocument();
    expect(URL.revokeObjectURL).not.toHaveBeenCalled();
  });

  it("continues extracting PDFs when preview rendering fails", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
    });
    mocks.renderPdfFirstPage.mockRejectedValueOnce(new Error("Preview failed."));

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["%PDF"], "event.pdf", { type: "application/pdf" }));

    await waitFor(() =>
      expect(mocks.streamExtraction).toHaveBeenCalledWith(
        expect.objectContaining({ mediaType: "application/pdf" }),
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByDisplayValue("Board meeting")).toBeInTheDocument();
    expect(screen.queryByText("Preview failed.")).not.toBeInTheDocument();
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
      expect(mocks.streamExtraction).toHaveBeenCalledWith(
        expect.objectContaining({ instructions: "Assume Europe/Berlin." }),
        expect.any(AbortSignal),
      ),
    );
  });

  it("combines saved and one-time instructions for extraction", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      customInstructions: "Assume Europe/Berlin.",
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    await user.click(screen.getByRole("button", { name: /add a note for this scan/i }));
    await user.type(
      screen.getByRole("textbox", { name: "Note for this scan" }),
      "Only include the highlighted row.",
    );
    await user.click(screen.getByRole("button", { name: /save note/i }));
    expect(await screen.findByText("Only include the highlighted row.")).toBeInTheDocument();

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() =>
      expect(mocks.streamExtraction).toHaveBeenCalledWith(
        expect.objectContaining({
          instructions: "Assume Europe/Berlin.\nOnly include the highlighted row.",
        }),
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByDisplayValue("Board meeting")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /new capture/i }));
    expect(await screen.findByRole("button", { name: /take photo/i })).toBeInTheDocument();
    expect(screen.queryByText("Only include the highlighted row.")).not.toBeInTheDocument();
  });

  it("saves a scan note to general instructions when requested", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      customInstructions: "Keep titles in English.",
    });

    render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    await user.click(screen.getByRole("button", { name: /add a note for this scan/i }));
    await user.type(
      screen.getByRole("textbox", { name: "Note for this scan" }),
      "Prefer venue names from the left column.",
    );
    await user.click(screen.getByLabelText(/also save to my general instructions/i));
    await user.click(screen.getByRole("button", { name: /save note/i }));

    await waitFor(() =>
      expect(mocks.setAiSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          customInstructions: "Keep titles in English.\nPrefer venue names from the left column.",
        }),
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

    await waitFor(() =>
      expect(mocks.streamExtraction).toHaveBeenCalledWith(
        expect.objectContaining({ provider: "openrouter" }),
        expect.any(AbortSignal),
      ),
    );
    expect(await screen.findByDisplayValue("Board meeting")).toBeInTheDocument();
  });

  it("shows the preview and streamed transcript while extraction runs", async () => {
    const user = userEvent.setup();
    let finishStream: () => void = () => undefined;
    const waitForFinish = new Promise<void>((resolve) => {
      finishStream = resolve;
    });
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
    });
    mocks.streamExtraction.mockImplementation(async function* () {
      yield { kind: "status", text: "Reading the capture." };
      yield { kind: "found", text: "Found event: Board meeting" };
      await waitForFinish;
      yield { kind: "done", events: [boardMeetingEvent()] };
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    expect(await screen.findByTestId("riso-thumb")).toHaveAccessibleName("Processing image capture");
    expect(screen.getByTestId("processing-label")).toHaveTextContent("Agent is working");
    const transcript = await screen.findByTestId("agent-transcript");
    expect(transcript).toHaveTextContent("status / Reading the capture.");
    expect(transcript).toHaveTextContent("found / Found event: Board meeting");
    expect(mocks.imagePreviewUrl).toHaveBeenCalledWith(expect.any(File));

    finishStream();
    expect(await screen.findByDisplayValue("Board meeting")).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("revokes image preview object URLs when extraction errors", async () => {
    const user = userEvent.setup();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
    });
    mocks.streamExtraction.mockImplementation(async function* () {
      yield { kind: "status", text: "Reading the capture." };
      yield { kind: "error", message: "Provider failed." };
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    expect(await screen.findByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText("Provider failed.")).toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });

  it("aborts the active stream when processing is cancelled", async () => {
    const user = userEvent.setup();
    let capturedSignal: AbortSignal | undefined;
    let resumeStream: () => void = () => undefined;
    const waitForResume = new Promise<void>((resolve) => {
      resumeStream = resolve;
    });
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
    });
    mocks.streamExtraction.mockImplementation(async function* (_input: unknown, signal?: AbortSignal) {
      capturedSignal = signal;
      yield { kind: "status", text: "Reading the capture." };
      await waitForResume;
      yield { kind: "done", events: [boardMeetingEvent()] };
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    await user.click(screen.getByRole("button", { name: /add a note for this scan/i }));
    await user.type(screen.getByRole("textbox", { name: "Note for this scan" }), "Use the red row.");
    await user.click(screen.getByRole("button", { name: /save note/i }));
    expect(await screen.findByText("Use the red row.")).toBeInTheDocument();

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    expect(await screen.findByTestId("agent-transcript")).toHaveTextContent("status / Reading the capture.");
    await user.click(screen.getByRole("button", { name: "Cancel" }));

    expect(capturedSignal?.aborted).toBe(true);
    expect(await screen.findByRole("button", { name: /take photo/i })).toBeInTheDocument();
    expect(screen.queryByText("Use the red row.")).not.toBeInTheDocument();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");

    resumeStream();
    await waitFor(() => expect(screen.queryByDisplayValue("Board meeting")).not.toBeInTheDocument());
    expect(mocks.openExternal).not.toHaveBeenCalled();
  });

  it("revokes stale image preview URLs without replacing the active preview", async () => {
    const user = userEvent.setup();
    const firstArrayBuffer = deferred<ArrayBuffer>();
    const holdStream = deferred();
    const firstFile = new File(["first"], "first.png", { type: "image/png" });
    const secondFile = new File(["second"], "second.png", { type: "image/png" });
    Object.defineProperty(firstFile, "arrayBuffer", {
      configurable: true,
      value: vi.fn(() => firstArrayBuffer.promise),
    });
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openai",
      providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
    });
    mocks.imagePreviewUrl
      .mockReturnValueOnce("blob:second")
      .mockReturnValueOnce("blob:first");
    mocks.streamExtraction.mockImplementation(async function* (_input: unknown, signal?: AbortSignal) {
      yield { kind: "status", text: "Reading the capture." };
      await holdStream.promise;
      if (signal?.aborted) return;
      yield { kind: "done", events: [boardMeetingEvent()] };
    });

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });
    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;

    await user.upload(upload, firstFile);
    await user.upload(upload, secondFile);
    expect(await screen.findByTestId("agent-transcript")).toHaveTextContent("status / Reading the capture.");

    firstArrayBuffer.resolve(new Uint8Array([1]).buffer);
    await waitFor(() => expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:first"));

    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(URL.revokeObjectURL).toHaveBeenLastCalledWith("blob:second");
    holdStream.resolve();
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

  it("stays on capture if processing is cancelled while the calendar open is pending", async () => {
    const user = userEvent.setup();
    const calendarOpen = deferred();
    mocks.getAiSettings.mockResolvedValue({
      selectedProvider: "openrouter",
      providers: { openrouter: { apiKey: "sk-or-test", model: "moonshotai/kimi-k2.6" } },
    });
    mocks.openExternal.mockReturnValueOnce(calendarOpen.promise);

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.openExternal).toHaveBeenCalledWith(expect.stringContaining("calendar.google.com")));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(await screen.findByRole("button", { name: /take photo/i })).toBeInTheDocument();

    calendarOpen.resolve();
    await calendarOpen.promise;
    expect(screen.queryByDisplayValue("Board meeting")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /take photo/i })).toBeInTheDocument();
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
    mockStreamEvents([
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

    await waitFor(() => expect(mocks.streamExtraction).toHaveBeenCalled());
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

    await waitFor(() => expect(mocks.streamExtraction).toHaveBeenCalled());
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

    await waitFor(() => expect(mocks.streamExtraction).toHaveBeenCalled());
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

    await waitFor(() => expect(mocks.streamExtraction).toHaveBeenCalled());
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
    mockStreamEvents([
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
    mockStreamEvents([
      { title: "Standup", start: "2026-06-10T09:00:00", end: null, allDay: false, location: null, description: null, timezone: null, confidence: 0.9 },
      { title: "Lunch", start: "2026-06-10T12:00:00", end: null, allDay: false, location: null, description: null, timezone: null, confidence: 0.8 },
    ]);

    const { container } = render(<App />);
    await screen.findByRole("button", { name: /take photo/i });

    const upload = container.querySelector('input[accept="image/*,application/pdf"]') as HTMLInputElement;
    await user.upload(upload, new File(["image"], "event.png", { type: "image/png" }));

    await waitFor(() => expect(mocks.streamExtraction).toHaveBeenCalled());
    const addBtns = await screen.findAllByRole("button", { name: /add to google calendar/i });
    expect(addBtns[0]).toBeInTheDocument();

    await user.click(addBtns[0]);
    // openExternal called exactly once — from the button click, not auto-open
    expect(mocks.openExternal).toHaveBeenCalledTimes(1);
    expect(mocks.openExternal).toHaveBeenCalledWith(expect.stringContaining("calendar.google.com"));
  });
});
