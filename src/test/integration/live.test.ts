// @vitest-environment node
//
// Live, end-to-end extraction tests against the real provider APIs. They cover
// BOTH code paths:
//   - "native"  -> extractEventsDirect()  (the path Tauri / Android uses)
//   - "PWA"     -> api/extract handler     (the path the web/PWA build uses)
//
// Two fixtures are exercised:
//   - sample-event (PNG + PDF) — a trivial single event, gated by each
//     provider's native image/PDF capability.
//   - probenplan.pdf — a real, dense multi-day rehearsal schedule. It runs
//     through EVERY provider regardless of native PDF support, because PDFs are
//     normalised per-provider before the call (image/PDF models read it
//     directly; text-only DeepSeek gets its extracted text). This is the
//     regression guard for the Android "Failed to process successful response"
//     bug, which was Kimi returning unparseable structured output via
//     OpenRouter's default upstream (now pinned to Weights & Biases).
//
// Each provider's tests only run when its API key is present in the environment
// (see KEY_ENV below); otherwise they are skipped, so a plain `pnpm test` with
// no keys stays fast and green. In CI the keys come from GitHub Actions secrets.
//
// Provider-side failures that are not our bug — no quota, invalid/empty key,
// rate limits, unknown model, flaky structured output — are turned into a
// runtime skip rather than a failure. A successful response, however, MUST
// contain the expected event(s), so genuine regressions still fail loudly.

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { extractEventsDirect } from "../../lib/aiCore";
import handler from "../../../api/extract";
import { AI_PROVIDER_ORDER, getProviderConfig, type AiProviderId } from "../../lib/aiProviders";
import type { CalendarEvent } from "../../lib/schema";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "..", "fixtures");

const NOW = { isoDate: "2026-06-06", weekday: "Saturday", tz: "Europe/Berlin" } as const;
// A live provider call that never answers would blow past vitest's hard test
// timeout and FAIL the run (this is what red CI was: OpenRouter/Kimi hanging
// >120s). Slowness is a provider problem, not ours, so we give each call its own
// deadline BELOW the hard timeout and treat "too slow" as a skip — same spirit
// as the quota/auth skips below. CALL_DEADLINE must stay < TIMEOUT so it wins.
const CALL_DEADLINE = 100_000;
const TIMEOUT = 120_000; // hard ceiling; the per-call deadline above trips first

const KEY_ENV: Record<AiProviderId, string> = {
  gemini: "GEMINI_API_KEY",
  anthropic: "ANTHROPIC_API_KEY",
  openai: "OPENAI_API_KEY",
  openrouter: "OPENROUTER_API_KEY",
  deepseek: "DEEPSEEK_API_KEY",
};

function keyFor(provider: AiProviderId): string {
  return (process.env[KEY_ENV[provider]] ?? "").trim();
}

const MEDIA = [
  { kind: "PNG image", mediaType: "image/png", file: "sample-event.png", needs: "supportsImages" as const },
  { kind: "PDF", mediaType: "application/pdf", file: "sample-event.pdf", needs: "supportsPdfs" as const },
];

function loadFixture(file: string): Uint8Array {
  return new Uint8Array(readFileSync(join(fixturesDir, file)));
}

// Errors that are about the account/key/model, not Calendrino's code:
//  - auth / quota / billing  -> the key isn't usable
//  - model capability        -> e.g. OpenRouter's Kimi can't reliably honour
//    JSON response_format and intermittently returns unparseable output
//    ("could not parse the response" / "no object generated"). That flakiness
//    is exactly why W&B is the preferred Kimi host; it's not our bug to fail on.
const SKIPPABLE =
  /quota|rate[\s_-]?limit|\b429\b|insufficient|exceeded|unauthorized|\b401\b|\b403\b|invalid.*api.*key|api.*key|permission|\b404\b|not found|no such model|billing|credit|payment|balance|could not parse|no object generated|response_format|structured\s?outputs?|deserialize/i;

function skipIfProviderError(skip: (note?: string) => void, error: unknown): never {
  const message = error instanceof Error ? error.message : String(error);
  if (SKIPPABLE.test(message)) {
    skip(`provider unavailable (skipped): ${message.slice(0, 200)}`);
  }
  throw error;
}

function tooSlowSkip(skip: (note?: string) => void): never {
  skip(`provider too slow (skipped): no response within ${CALL_DEADLINE / 1000}s`);
  throw new Error("unreachable"); // skip() throws; this only satisfies `never`
}

function expectKickoffEvent(events: CalendarEvent[]): void {
  expect(Array.isArray(events)).toBe(true);
  expect(events.length).toBeGreaterThanOrEqual(1);
  const hit = events.find((e) => typeof e.start === "string" && e.start.startsWith("2026-03-13"));
  expect(hit, `expected an event on 2026-03-13, got: ${JSON.stringify(events)}`).toBeTruthy();
}

// The Probenplan covers the rehearsal week Mon 8 – Fri 12 June 2026 with many
// timed slots. Models split/merge the slots differently, so assert loosely:
// several events, at least one landing inside that week.
function expectProbenplanEvents(events: CalendarEvent[]): void {
  expect(Array.isArray(events)).toBe(true);
  expect(events.length, `expected several rehearsal events, got: ${JSON.stringify(events)}`).toBeGreaterThanOrEqual(3);
  const inWeek = events.filter((e) => typeof e.start === "string" && /^2026-06-(08|09|10|11|12)/.test(e.start));
  expect(
    inWeek.length,
    `expected events in the week of 2026-06-08..12, got starts: ${JSON.stringify(events.map((e) => e.start))}`,
  ).toBeGreaterThanOrEqual(1);
}

function bytesToBase64(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64");
}

// Minimal stand-in for the Vercel req/res pair the PWA proxy handler expects.
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

// The native (Tauri/Android) path. Aborts the underlying request once the
// deadline passes so a hung provider surfaces as a skip, not a test-timeout.
async function extractNative(
  provider: AiProviderId,
  bytes: Uint8Array,
  mediaType: string,
  skip: (note?: string) => void,
): Promise<CalendarEvent[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), CALL_DEADLINE);
  try {
    return await extractEventsDirect({
      bytes,
      mediaType,
      provider,
      apiKey: keyFor(provider),
      now: NOW,
      fetch: (input, init) => globalThis.fetch(input, { ...init, signal: controller.signal }),
    });
  } catch (error) {
    if (controller.signal.aborted) tooSlowSkip(skip);
    skipIfProviderError(skip, error);
  } finally {
    clearTimeout(timer);
  }
}

// The PWA proxy path. The handler owns its own (global) fetch, so we can't abort
// it; race it against the deadline instead and skip if the provider is too slow.
async function extractViaProxy(
  provider: AiProviderId,
  bytes: Uint8Array,
  mediaType: string,
  skip: (note?: string) => void,
): Promise<CalendarEvent[]> {
  const res = createRes();
  const call = handler(
    {
      method: "POST",
      body: { mediaBase64: bytesToBase64(bytes), mediaType, provider, apiKey: keyFor(provider), now: NOW },
    } as never,
    res as never,
  );
  const tooSlow = Symbol("too-slow");
  let timer: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<typeof tooSlow>((resolve) => {
    timer = setTimeout(() => resolve(tooSlow), CALL_DEADLINE);
  });
  const outcome = await Promise.race([call.then(() => "done" as const, () => "done" as const), deadline]);
  clearTimeout(timer);
  if (outcome === tooSlow) tooSlowSkip(skip);

  if (res.statusCode !== 200) {
    const message =
      res.body && typeof res.body === "object" && "error" in res.body
        ? String((res.body as { error: unknown }).error)
        : `HTTP ${res.statusCode}`;
    skipIfProviderError(skip, new Error(message));
  }
  expect(res.statusCode).toBe(200);
  return (res.body as { events: CalendarEvent[] }).events;
}

for (const provider of AI_PROVIDER_ORDER) {
  const config = getProviderConfig(provider);
  const hasKey = keyFor(provider).length > 0;

  describe.skipIf(!hasKey)(`live extraction · ${config.label}`, () => {
    for (const media of MEDIA) {
      const supported = config[media.needs];

      it.skipIf(!supported)(
        `native path extracts the event from a ${media.kind}`,
        async ({ skip }) => {
          expectKickoffEvent(await extractNative(provider, loadFixture(media.file), media.mediaType, skip));
        },
        TIMEOUT,
      );

      it.skipIf(!supported)(
        `PWA proxy extracts the event from a ${media.kind}`,
        async ({ skip }) => {
          expectKickoffEvent(await extractViaProxy(provider, loadFixture(media.file), media.mediaType, skip));
        },
        TIMEOUT,
      );
    }

    // The real Probenplan PDF runs through every provider — natively where PDFs
    // are supported, via extracted text for DeepSeek — so it's not gated on
    // `supportsPdfs`. This is the regression guard for the in-app failure.
    it(
      "native path extracts the rehearsal week from the Probenplan PDF",
      async ({ skip }) => {
        expectProbenplanEvents(await extractNative(provider, loadFixture("probenplan.pdf"), "application/pdf", skip));
      },
      TIMEOUT,
    );

    it(
      "PWA proxy extracts the rehearsal week from the Probenplan PDF",
      async ({ skip }) => {
        expectProbenplanEvents(await extractViaProxy(provider, loadFixture("probenplan.pdf"), "application/pdf", skip));
      },
      TIMEOUT,
    );
  });
}
