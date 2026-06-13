import { beforeEach, describe, expect, it, vi } from "vitest";
import { extractEvents } from "./ai";

const mocks = vi.hoisted(() => ({
  isTauri: vi.fn(() => false),
  extractEventsDirect: vi.fn(async () => []),
}));

vi.mock("./platform", () => ({
  aiFetch: vi.fn(),
  isTauri: mocks.isTauri,
}));
vi.mock("./aiCore", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./aiCore")>();
  return {
    ...actual,
    extractEventsDirect: mocks.extractEventsDirect,
  };
});

const baseInput = {
  bytes: new Uint8Array([1, 2, 3]),
  mediaType: "image/png",
  provider: "openai",
  apiKey: "key",
  now: { isoDate: "2026-06-06", weekday: "Saturday", tz: "Europe/Berlin" },
} as const;

describe("extractEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.isTauri.mockReturnValue(false);
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ events: [] }), { status: 200 }));
  });

  it("uses the browser proxy outside Tauri", async () => {
    await extractEvents({ ...baseInput, instructions: "Assume Europe/Berlin." });

    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/extract",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
      }),
    );
    const [, init] = vi.mocked(globalThis.fetch).mock.calls[0];
    expect(JSON.parse(String(init?.body))).toEqual(
      expect.objectContaining({
        mediaBase64: "AQID",
        mediaType: "image/png",
        provider: "openai",
        apiKey: "key",
        instructions: "Assume Europe/Berlin.",
      }),
    );
    expect(mocks.extractEventsDirect).not.toHaveBeenCalled();
  });

  it("converts proxy errors into app errors", async () => {
    globalThis.fetch = vi.fn(async () => new Response(JSON.stringify({ error: "Invalid API key." }), { status: 401 }));

    await expect(extractEvents(baseInput)).rejects.toThrow("Invalid API key.");
  });

  it("keeps direct extraction in Tauri", async () => {
    mocks.isTauri.mockReturnValue(true);

    await extractEvents({ ...baseInput, instructions: "Assume Europe/Berlin." });

    expect(mocks.extractEventsDirect).toHaveBeenCalledWith(
      expect.objectContaining({ bytes: baseInput.bytes, instructions: "Assume Europe/Berlin." }),
    );
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
