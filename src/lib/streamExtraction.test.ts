import { simulateReadableStream } from "ai/test";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { streamExtractionDirect } from "./aiCore";
import { parseTranscriptNdjson, streamExtraction } from "./ai";
import type { CalendarEvent } from "./schema";

const mocks = vi.hoisted(() => ({
  streamObject: vi.fn(),
  generateObject: vi.fn(async (_args: unknown) => ({ object: { events: [] } })),
  createOpenAI: vi.fn(() => vi.fn((model: string) => ({ provider: "openai", model }))),
  createGoogleGenerativeAI: vi.fn(() => vi.fn((model: string) => ({ provider: "gemini", model }))),
  createAnthropic: vi.fn(() => vi.fn((model: string) => ({ provider: "anthropic", model }))),
  createOpenAICompatible: vi.fn(() => vi.fn((model: string) => ({ provider: "openrouter", model }))),
  isTauri: vi.fn(() => false),
  aiFetch: vi.fn(),
}));

vi.mock("ai", () => ({ generateObject: mocks.generateObject, streamObject: mocks.streamObject }));
vi.mock("./mediaPrep", () => ({
  EXTRACTED_TEXT_MEDIA_TYPE: "text/plain",
  prepareMediaForProvider: vi.fn(async (input: { bytes: Uint8Array; mediaType: string }) => ({
    bytes: input.bytes,
    mediaType: input.mediaType,
  })),
}));
vi.mock("@ai-sdk/openai", () => ({ createOpenAI: mocks.createOpenAI }));
vi.mock("@ai-sdk/google", () => ({ createGoogleGenerativeAI: mocks.createGoogleGenerativeAI }));
vi.mock("@ai-sdk/anthropic", () => ({ createAnthropic: mocks.createAnthropic }));
vi.mock("@ai-sdk/openai-compatible", () => ({ createOpenAICompatible: mocks.createOpenAICompatible }));
vi.mock("./platform", () => ({
  aiFetch: mocks.aiFetch,
  isTauri: mocks.isTauri,
}));

const dinner: CalendarEvent = {
  title: "Dinner",
  start: "2026-06-06T19:00:00",
  end: "2026-06-06T20:30:00",
  allDay: false,
  location: "Trattoria",
  description: null,
  timezone: null,
  confidence: 0.92,
};

const dentist: CalendarEvent = {
  title: "Dentist",
  start: "2026-06-07T09:00:00",
  end: "2026-06-07T10:00:00",
  allDay: false,
  location: null,
  description: null,
  timezone: null,
  confidence: 0.88,
};

const baseInput = {
  bytes: new Uint8Array([1, 2, 3]),
  mediaType: "image/png",
  provider: "openai",
  apiKey: "key",
  now: { isoDate: "2026-06-06", weekday: "Saturday", tz: "Europe/Berlin" },
} as const;

describe("streamExtractionDirect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.streamObject.mockReset();
    mocks.isTauri.mockReturnValue(false);
  });

  it("emits scripted status, found, and done chunks in order", async () => {
    const signal = new AbortController().signal;
    mocks.streamObject.mockReturnValue({
      partialObjectStream: streamFrom([
        { events: [{ title: "Dinner" }] },
        { events: [{ title: "Dinner" }, { title: "Dentist" }] },
      ]),
      object: Promise.resolve({ events: [dinner, dentist] }),
    });

    const chunks = await collect(
      streamExtractionDirect({ ...baseInput, instructions: "Prefer German titles.", abortSignal: signal }),
    );

    expect(chunks.map((chunk) => chunk.kind)).toEqual([
      "status",
      "status",
      "status",
      "found",
      "found",
      "done",
    ]);
    expect(chunks.filter((chunk) => chunk.kind === "found").map((chunk) => chunk.text)).toEqual([
      "Found event: Dinner",
      "Found event: Dentist",
    ]);
    expect(chunks[chunks.length - 1]).toEqual({ kind: "done", events: [dinner, dentist] });
    expect(mocks.streamObject).toHaveBeenCalledWith(
      expect.objectContaining({
        abortSignal: signal,
        system: expect.stringContaining("Prefer German titles."),
        messages: expect.arrayContaining([expect.objectContaining({ role: "user" })]),
      }),
    );
  });

  it("emits an error chunk when the object stream fails", async () => {
    mocks.streamObject.mockReturnValue({
      partialObjectStream: failingStream(new Error("Provider stream failed.")),
      object: Promise.resolve({ events: [] }),
    });

    const chunks = await collect(streamExtractionDirect(baseInput));

    expect(chunks[chunks.length - 1]).toEqual({ kind: "error", message: "Provider stream failed." });
  });

  it("observes the final object promise when the partial stream fails first", async () => {
    let rejectObject: ((error: Error) => void) | undefined;
    const finalObject = new Promise<{ events: CalendarEvent[] }>((_resolve, reject) => {
      rejectObject = reject;
    });
    const catchSpy = vi.spyOn(finalObject, "catch");
    mocks.streamObject.mockReturnValue({
      partialObjectStream: rejectObjectAndFailStream(
        () => rejectObject?.(new Error("Final object failed.")),
        new Error("Provider stream failed."),
      ),
      object: finalObject,
    });

    const chunks = await collect(streamExtractionDirect(baseInput));

    expect(catchSpy).toHaveBeenCalledTimes(1);
    expect(chunks[chunks.length - 1]).toEqual({ kind: "error", message: "Provider stream failed." });
  });

  it("emits an error chunk when final object validation fails", async () => {
    mocks.streamObject.mockReturnValue({
      partialObjectStream: streamFrom([{ events: [{ title: "Dinner" }] }]),
      object: Promise.reject(new Error("Invalid object.")),
    });

    const chunks = await collect(streamExtractionDirect(baseInput));

    expect(chunks).toContainEqual({ kind: "found", text: "Found event: Dinner" });
    expect(chunks[chunks.length - 1]).toEqual({ kind: "error", message: "Invalid object." });
  });

  it("rejects unsupported media before starting the provider stream", async () => {
    const chunks = await collect(streamExtractionDirect({ ...baseInput, provider: "deepseek" }));

    expect(mocks.streamObject).not.toHaveBeenCalled();
    expect(chunks[chunks.length - 1]).toEqual({
      kind: "error",
      message: "DeepSeek does not support images in Calendrino yet.",
    });
  });
});

describe("streamExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.streamObject.mockReset();
    mocks.isTauri.mockReturnValue(false);
  });

  it("POSTs to the web stream endpoint and parses NDJSON split across body chunks", async () => {
    const signal = new AbortController().signal;
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn(async () => new Response(
      streamFrom([
        encoder.encode('{"kind":"status","text":"Preparing"}\n{"kind":"found"'),
        encoder.encode(',"text":"Found event: Dinner"}\n'),
        encoder.encode(`${JSON.stringify({ kind: "done", events: [dinner] })}\n`),
      ]),
      { status: 200 },
    ));

    const chunks = await collect(streamExtraction({ ...baseInput, instructions: "Prefer German titles." }, signal));

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/extract-stream",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        signal,
      }),
    );
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual(expect.objectContaining({ instructions: "Prefer German titles." }));
    expect(chunks).toEqual([
      { kind: "status", text: "Preparing" },
      { kind: "found", text: "Found event: Dinner" },
      { kind: "done", events: [dinner] },
    ]);
  });

  it("parses a trailing NDJSON line without a final newline", async () => {
    const encoder = new TextEncoder();
    const chunks = await collect(
      parseTranscriptNdjson(streamFrom([encoder.encode('{"kind":"status","text":"Preparing"}')])),
    );

    expect(chunks).toEqual([{ kind: "status", text: "Preparing" }]);
  });

  it("throws a useful error when the stream response has no body", async () => {
    globalThis.fetch = vi.fn(async () => new Response(null, { status: 500 }));

    await expect(collect(streamExtraction(baseInput))).rejects.toThrow("AI extraction failed with HTTP 500.");
  });

  it("yields NDJSON error chunks from non-OK responses", async () => {
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn(async () => new Response(
      streamFrom([encoder.encode('{"kind":"error","message":"Invalid API key."}\n')]),
      { status: 401 },
    ));

    await expect(collect(streamExtraction(baseInput))).resolves.toEqual([
      { kind: "error", message: "Invalid API key." },
    ]);
  });

  it("rejects malformed NDJSON", async () => {
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn(async () => new Response(streamFrom([encoder.encode("{not-json}\n")])));

    await expect(collect(streamExtraction(baseInput))).rejects.toThrow();
  });

  it("rejects schema-invalid transcript chunks", async () => {
    const encoder = new TextEncoder();
    globalThis.fetch = vi.fn(async () => new Response(
      streamFrom([encoder.encode('{"kind":"thinking","text":"Unsupported"}\n')]),
    ));

    await expect(collect(streamExtraction(baseInput))).rejects.toThrow();
  });
});

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

function streamFrom<T>(chunks: T[]): ReadableStream<T> {
  return simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null });
}

async function* failingStream(error: Error): AsyncIterable<unknown> {
  throw error;
}

async function* rejectObjectAndFailStream(rejectObject: () => void, error: Error): AsyncIterable<unknown> {
  rejectObject();
  throw error;
}
