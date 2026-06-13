// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";
import handler from "./extract";
import { extractEventsDirect } from "../src/lib/aiCore";

vi.mock("../src/lib/aiCore", () => ({
  extractEventsDirect: vi.fn(async () => [
    {
      title: "Dinner",
      start: "2026-06-06T19:00:00",
      end: null,
      allDay: false,
      location: null,
      description: null,
      timezone: null,
      confidence: 0.9,
    },
  ]),
}));

function createRes() {
  return {
    statusCode: 200,
    headers: {} as Record<string, string>,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
    setHeader(name: string, value: string) {
      this.headers[name] = value;
    },
  };
}

const validBody = {
  mediaBase64: "AQID",
  mediaType: "image/png",
  provider: "openai",
  apiKey: "key",
  instructions: "Assume Europe/Berlin.",
  now: { isoDate: "2026-06-06", weekday: "Saturday", tz: "Europe/Berlin" },
};

describe("api/extract", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects non-POST requests", async () => {
    const res = createRes();

    await handler({ method: "GET", body: validBody } as never, res as never);

    expect(res.statusCode).toBe(405);
    expect(res.headers.Allow).toBe("POST");
    expect(res.body).toEqual({ error: "Method not allowed." });
  });

  it("rejects invalid request bodies", async () => {
    const res = createRes();

    await handler({ method: "POST", body: { mediaBase64: "" } } as never, res as never);

    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: "Invalid extraction request." });
    expect(extractEventsDirect).not.toHaveBeenCalled();
  });

  it("decodes media and returns extracted events", async () => {
    const res = createRes();

    await handler({ method: "POST", body: validBody } as never, res as never);

    expect(extractEventsDirect).toHaveBeenCalledWith(
      expect.objectContaining({
        bytes: new Uint8Array([1, 2, 3]),
        mediaType: "image/png",
        provider: "openai",
        apiKey: "key",
        instructions: "Assume Europe/Berlin.",
      }),
    );
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({
      events: [
        {
          title: "Dinner",
          start: "2026-06-06T19:00:00",
          end: null,
          allDay: false,
          location: null,
          description: null,
          timezone: null,
          confidence: 0.9,
        },
      ],
    });
  });

  // Regression: on the PWA every provider 400'd because the body arrived as a
  // raw JSON string (unparsed) and Zod was handed a string instead of an object.
  it("accepts a raw JSON string body (PWA proxy regression)", async () => {
    const res = createRes();

    await handler({ method: "POST", body: JSON.stringify(validBody) } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(extractEventsDirect).toHaveBeenCalled();
  });

  it("accepts a Buffer body", async () => {
    const res = createRes();

    await handler({ method: "POST", body: Buffer.from(JSON.stringify(validBody)) } as never, res as never);

    expect(res.statusCode).toBe(200);
    expect(extractEventsDirect).toHaveBeenCalled();
  });
});
