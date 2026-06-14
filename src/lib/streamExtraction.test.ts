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
    mocks.isTauri.mockReturnValue(false);
  });

  it("emits scripted status, found, thinking, and done chunks in order", async () => {
    mocks.streamObject.mockReturnValue({
      fullStream: streamFrom([
        { type: "object", object: { events: [{ title: "Dinner" }] } },
        { type: "reasoning-delta", delta: "Checking the timezone." },
        { type: "object", object: { events: [{ title: "Dinner" }, { title: "Dentist" }] } },
        { type: "finish", finishReason: "stop", usage: {}, response: {} },
      ]),
      object: Promise.resolve({ events: [dinner, dentist] }),
    });

    const chunks = await collect(streamExtractionDirect({ ...baseInput, instructions: "Prefer German titles." }));

    expect(chunks.map((chunk) => chunk.kind)).toEqual([
      "status",
      "status",
      "status",
      "found",
      "thinking",
      "found",
      "done",
    ]);
    expect(chunks.filter((chunk) => chunk.kind === "found").map((chunk) => chunk.text)).toEqual([
      "Found event: Dinner",
      "Found event: Dentist",
    ]);
    expect(chunks).toContainEqual({ kind: "thinking", text: "Checking the timezone." });
    expect(chunks[chunks.length - 1]).toEqual({ kind: "done", events: [dinner, dentist] });
    expect(mocks.streamObject).toHaveBeenCalledWith(
      expect.objectContaining({
        system: expect.stringContaining("Prefer German titles."),
        messages: expect.arrayContaining([expect.objectContaining({ role: "user" })]),
      }),
    );
  });
});

describe("streamExtraction", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});

async function collect<T>(iterable: AsyncIterable<T>): Promise<T[]> {
  const values: T[] = [];
  for await (const value of iterable) values.push(value);
  return values;
}

function streamFrom<T>(chunks: T[]): ReadableStream<T> {
  return simulateReadableStream({ chunks, initialDelayInMs: null, chunkDelayInMs: null });
}
