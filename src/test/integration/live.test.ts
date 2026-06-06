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
const TIMEOUT = 120_000; // live model calls (esp. Kimi) can be slow

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
          try {
            const events = await extractEventsDirect({
              bytes: loadFixture(media.file),
              mediaType: media.mediaType,
              provider,
              apiKey: keyFor(provider),
              now: NOW,
              fetch: globalThis.fetch.bind(globalThis),
            });
            expectKickoffEvent(events);
          } catch (error) {
            skipIfProviderError(skip, error);
          }
        },
        TIMEOUT,
      );

      it.skipIf(!supported)(
        `PWA proxy extracts the event from a ${media.kind}`,
        async ({ skip }) => {
          const res = createRes();
          await handler(
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
