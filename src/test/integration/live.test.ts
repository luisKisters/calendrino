// @vitest-environment node
//
// Live, end-to-end extraction tests against the real provider APIs, using a
// committed sample event as both a PDF and a PNG. They cover BOTH code paths:
//   - "native"  -> extractEventsDirect()  (the path Tauri / Android uses)
//   - "PWA"     -> api/extract handler     (the path the web/PWA build uses)
//
// Each provider's tests only run when its API key is present in the environment
// (see KEY_ENV below); otherwise they are skipped, so a plain `pnpm test` with
// no keys stays fast and green. In CI the keys come from GitHub Actions secrets.
//
// Provider-side failures that are not our bug — no quota, invalid/empty key,
// rate limits, unknown model — are turned into a runtime skip rather than a
// failure (the user asked us to skip when quota/keys are the problem). A
// successful response, however, MUST contain the expected event, so genuine
// regressions still fail loudly.

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
  wandb: "WANDB_API_KEY",
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

for (const provider of AI_PROVIDER_ORDER) {
  const config = getProviderConfig(provider);
  const hasKey = keyFor(provider).length > 0;

  describe.skipIf(!hasKey)(`live extraction · ${config.label}`, () => {
    for (const media of MEDIA) {
      const supported = config[media.needs];

      it.skipIf(!supported)(
        `native path extracts the event from a ${media.kind}`,
        async ({ skip }) => {
          // Abort the underlying request once the deadline passes so a hung
          // provider surfaces as a skip instead of a hard test-timeout failure.
          const controller = new AbortController();
          const timer = setTimeout(() => controller.abort(), CALL_DEADLINE);
          try {
            const events = await extractEventsDirect({
              bytes: loadFixture(media.file),
              mediaType: media.mediaType,
              provider,
              apiKey: keyFor(provider),
              now: NOW,
              fetch: (input, init) => globalThis.fetch(input, { ...init, signal: controller.signal }),
            });
            expectKickoffEvent(events);
          } catch (error) {
            if (controller.signal.aborted) tooSlowSkip(skip);
            skipIfProviderError(skip, error);
          } finally {
            clearTimeout(timer);
          }
        },
        TIMEOUT,
      );

      it.skipIf(!supported)(
        `PWA proxy extracts the event from a ${media.kind}`,
        async ({ skip }) => {
          const res = createRes();
          // The handler owns its own (global) fetch, so we can't abort it; race
          // it against the deadline instead and skip if the provider is too slow.
          const call = handler(
            {
              method: "POST",
              body: {
                mediaBase64: bytesToBase64(loadFixture(media.file)),
                mediaType: media.mediaType,
                provider,
                apiKey: keyFor(provider),
                now: NOW,
              },
            } as never,
            res as never,
          );
          const tooSlow = Symbol("too-slow");
          let timer: ReturnType<typeof setTimeout> | undefined;
          const deadline = new Promise<typeof tooSlow>((resolve) => {
            timer = setTimeout(() => resolve(tooSlow), CALL_DEADLINE);
          });
          const outcome = await Promise.race([
            call.then(() => "done" as const, () => "done" as const),
            deadline,
          ]);
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
          expectKickoffEvent((res.body as { events: CalendarEvent[] }).events);
        },
        TIMEOUT,
      );
    }
  });
}
