// @vitest-environment node
import { EventEmitter } from "node:events";
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./extract-stream";
import { streamExtractionDirect } from "../src/lib/aiCore";
import type { CalendarEvent } from "../src/lib/schema";
import { MAX_BASE64_CHARS, MAX_MEDIA_BYTES } from "./extract";

vi.mock("../src/lib/aiCore", () => ({
  streamExtractionDirect: vi.fn(async function* () {
    yield { kind: "status", text: "Preparing" };
    yield { kind: "done", events: [dinner] };
  }),
}));

const dinner: CalendarEvent = {
  title: "Dinner",
  start: "2026-06-06T19:00:00",
  end: null,
  allDay: false,
  location: null,
  description: null,
  timezone: null,
  confidence: 0.9,
};

const validBody = {
  mediaBase64: "AQID",
  mediaType: "image/png",
  provider: "openai",
  apiKey: "key",
  instructions: "Prefer German titles.",
  now: { isoDate: "2026-06-06", weekday: "Saturday", tz: "Europe/Berlin" },
};

describe("api/extract-stream", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-POST requests with an NDJSON error chunk", async () => {
    const res = createRes();

    await handler(createReq("GET", validBody) as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
    expect(res.lines()).toEqual([{ kind: "error", message: "Method not allowed." }]);
    expect(res.ended).toBe(true);
  });

  it("streams extracted chunks as NDJSON", async () => {
    const res = createRes();

    await handler(createReq("POST", validBody) as never, res as never);

    expect(streamExtractionDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        bytes: new Uint8Array([1, 2, 3]),
        mediaType: "image/png",
        provider: "openai",
        apiKey: "key",
        instructions: "Prefer German titles.",
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.headers["Content-Type"]).toBe("application/x-ndjson; charset=utf-8");
    expect(res.lines()).toEqual([
      { kind: "status", text: "Preparing" },
      { kind: "done", events: [dinner] },
    ]);
    expect(res.ended).toBe(true);
  });

  it("accepts a raw JSON string request body", async () => {
    const res = createRes();

    await handler(createReq("POST", JSON.stringify(validBody)) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(streamExtractionDirect).toHaveBeenCalledOnce();
  });

  it("rejects invalid request bodies before extraction", async () => {
    const res = createRes();

    await handler(createReq("POST", { ...validBody, provider: "not-a-provider" }) as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.lines()).toEqual([{ kind: "error", message: "Invalid extraction request." }]);
    expect(streamExtractionDirect).not.toHaveBeenCalled();
  });

  it("rejects media that is too large by base64 length before extraction", async () => {
    const res = createRes();

    await handler(
      createReq("POST", { ...validBody, mediaBase64: "A".repeat(MAX_BASE64_CHARS + 1) }) as never,
      res as never,
    );

    expect(res.statusCode).toBe(413);
    expect(res.lines()).toEqual([{ kind: "error", message: "Uploaded file is too large." }]);
    expect(streamExtractionDirect).not.toHaveBeenCalled();
  });

  it("rejects media that is too large after decoding before writing 200 headers", async () => {
    const res = createRes();
    const mediaBase64 = Buffer.alloc(MAX_MEDIA_BYTES + 1).toString("base64");
    expect(mediaBase64.length).toBeLessThanOrEqual(MAX_BASE64_CHARS);

    await handler(createReq("POST", { ...validBody, mediaBase64 }) as never, res as never);

    expect(res.statusCode).toBe(413);
    expect(res.lines()).toEqual([{ kind: "error", message: "Uploaded file is too large." }]);
    expect(streamExtractionDirect).not.toHaveBeenCalled();
  });

  it("streams generator failures as NDJSON error chunks", async () => {
    vi.mocked(streamExtractionDirect).mockImplementationOnce(async function* () {
      yield { kind: "status", text: "Preparing" };
      throw new Error("Provider failed.");
    });
    const res = createRes();

    await handler(createReq("POST", validBody) as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(res.lines()).toEqual([
      { kind: "status", text: "Preparing" },
      { kind: "error", message: "Provider failed." },
    ]);
    expect(res.ended).toBe(true);
  });

  it("passes an abort signal that fires when the request closes", async () => {
    const req = createReq("POST", validBody);
    const res = createRes();
    let signal: AbortSignal | undefined;
    vi.mocked(streamExtractionDirect).mockImplementationOnce(async function* (input) {
      signal = input.abortSignal;
      req.emit("aborted");
      yield { kind: "error", message: signal?.aborted ? "Aborted." : "Still open." };
    });

    await handler(req as never, res as never);

    expect(signal?.aborted).toBe(true);
    expect(res.lines()).toEqual([{ kind: "error", message: "Aborted." }]);
  });
});

function createReq(method: string, body: unknown) {
  return Object.assign(new EventEmitter(), { method, body });
}

function createRes() {
  return Object.assign(new EventEmitter(), {
    statusCode: 200,
    headers: {} as Record<string, string>,
    chunks: [] as string[],
    ended: false,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    write(chunk: string) {
      this.chunks.push(chunk);
      return true;
    },
    end() {
      this.ended = true;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
    lines() {
      return this.chunks.join("").trim().split("\n").filter(Boolean).map((line) => JSON.parse(line) as unknown);
    },
  });
}
