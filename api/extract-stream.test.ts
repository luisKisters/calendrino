// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./extract-stream";
import { streamExtractionDirect } from "../src/lib/aiCore";
import type { CalendarEvent } from "../src/lib/schema";

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

    await handler({ method: "GET", body: validBody } as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
    expect(res.lines()).toEqual([{ kind: "error", message: "Method not allowed." }]);
    expect(res.ended).toBe(true);
  });

  it("streams extracted chunks as NDJSON", async () => {
    const res = createRes();

    await handler({ method: "POST", body: validBody } as never, res as never);

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
});

function createRes() {
  return {
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
  };
}
