import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject, type JSONValue, type UserContent } from "ai";
import { getProviderConfig, type AiProviderId } from "./aiProviders.js";
import type { NowContext } from "./datetime.js";
import { EXTRACTED_TEXT_MEDIA_TYPE, prepareMediaForProvider } from "./mediaPrep.js";
import { EventsSchema, type CalendarEvent } from "./schema.js";

export interface DirectExtractInput {
  bytes: Uint8Array;
  mediaType: string;
  provider: AiProviderId;
  apiKey: string;
  model?: string;
  /** Optional free-text user guidance appended to the extraction prompt. */
  customInstructions?: string;
  now: NowContext;
  fetch?: typeof fetch;
}

function systemPrompt(now: NowContext, customInstructions?: string): string {
  const lines = [
    "You extract calendar events from the provided image, PDF, text, or audio.",
    `Today is ${now.isoDate} (${now.weekday}); the user's timezone is ${now.tz}.`,
    "Identify every distinct event and return it as structured data. Rules:",
    '- Resolve relative dates ("tomorrow", "next Friday") against today.',
    "- Use local wall-clock ISO 8601 WITHOUT any timezone suffix for start/end",
    "  (e.g. 2026-06-12T19:30:00). For all-day events use a date only (2026-06-12).",
    "- Always give timed events a sensible end time. Use the stated end if present;",
    "  otherwise estimate a realistic duration from the event type (meeting or",
    "  appointment ~1h, meal ~1.5h, party or concert ~3h, flight from its route) so",
    "  the event has a plausible length. The end MUST be after the start. Only leave",
    "  end null for all-day events or when no reasonable duration can be inferred.",
    "- Set allDay=true only for date-only events with no specific time.",
    "- Set timezone (IANA, e.g. Europe/Berlin) ONLY if the source explicitly implies",
    "  a specific timezone (e.g. a flight or a webinar in another city); otherwise null.",
    "- Never invent details. Use null for anything not clearly present.",
    "- confidence is your 0..1 certainty that this is a real, schedulable event.",
    "- If there are no events at all, return an empty events array.",
  ];
  const extra = customInstructions?.trim();
  if (extra) {
    // User-supplied guidance. Keep it clearly fenced and subordinate to the rules
    // above so it can't redefine the output schema, only steer interpretation.
    lines.push(
      "",
      "Additional instructions from the user (follow them unless they conflict with the rules above):",
      extra,
    );
  }
  return lines.join("\n");
}

function resolveModelId(input: DirectExtractInput): string {
  return input.model?.trim() || getProviderConfig(input.provider).defaultModel;
}

function modelFor(input: DirectExtractInput, modelId: string) {
  const fetchOverride = input.fetch;
  switch (input.provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: input.apiKey, fetch: fetchOverride });
      return google(modelId);
    }
    case "anthropic": {
      const anthropic = createAnthropic({
        apiKey: input.apiKey,
        fetch: fetchOverride,
        // The Tauri webview is a browser-origin context, so Anthropic's API
        // rejects the direct call with a CORS error (surfaced as a 500 in-app)
        // unless we opt in to direct browser access. Harmless server-side too.
        headers: { "anthropic-dangerous-direct-browser-access": "true" },
      });
      return anthropic(modelId);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: input.apiKey, fetch: fetchOverride });
      return openai(modelId);
    }
    case "openrouter": {
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        apiKey: input.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        fetch: fetchOverride,
      });
      return openrouter(modelId);
    }
    case "deepseek": {
      const deepseek = createOpenAICompatible({
        name: "deepseek",
        apiKey: input.apiKey,
        baseURL: "https://api.deepseek.com/v1",
        fetch: fetchOverride,
      });
      return deepseek(modelId);
    }
  }
}

/**
 * OpenRouter upstream routing. OpenRouter fans a model out across several
 * upstream inference providers; for Kimi its default upstreams intermittently
 * return JSON that doesn't honour the requested structure, which surfaces in-app
 * as the AI SDK's "Failed to process successful response" (a 2xx whose body fails
 * to parse). Weights & Biases Inference serves Kimi reliably and at high
 * throughput, so we pin the W&B upstream — but ONLY for Kimi (W&B doesn't serve
 * other models). OpenAI-namespaced models pin to OpenAI's own endpoint; anything
 * else is left to OpenRouter's normal routing. Passed through
 * `providerOptions.openrouter`, the openai-compatible provider forwards unknown
 * keys verbatim into the request body, so this lands as OpenRouter's top-level
 * `provider` routing field.
 */
function openRouterProviderRouting(modelId: string): Record<string, JSONValue> | undefined {
  const id = modelId.toLowerCase();
  if (id.includes("kimi")) {
    return { provider: { order: ["wandb"], allow_fallbacks: false } };
  }
  if (id.startsWith("openai/") || id.includes("gpt-")) {
    return { provider: { order: ["openai"], allow_fallbacks: false } };
  }
  return undefined;
}

/**
 * Per-provider tuning so extraction is fast and deterministic: a low temperature
 * where the provider supports it, and the lightest available reasoning/thinking
 * setting so the model doesn't spend time "thinking" on a simple extraction.
 */
function callTuning(
  provider: AiProviderId,
  modelId: string,
): {
  temperature?: number;
  providerOptions?: Record<string, Record<string, JSONValue>>;
} {
  switch (provider) {
    case "gemini":
      // Gemini 3 always reasons; "low" keeps it quick without a long thinking pass.
      return { temperature: 0, providerOptions: { google: { thinkingConfig: { thinkingLevel: "low" } } } };
    case "anthropic":
      // Haiku 4.5 has extended thinking off by default — just pin determinism.
      return { temperature: 0 };
    case "openai":
      // GPT-5.x reasoning models reject `temperature`; minimise reasoning for speed instead.
      return { providerOptions: { openai: { reasoningEffort: "minimal" } } };
    case "openrouter": {
      const routing = openRouterProviderRouting(modelId);
      return routing ? { temperature: 0, providerOptions: { openrouter: routing } } : { temperature: 0 };
    }
    case "deepseek":
      // DeepSeek V4 enables "thinking" by default; disable it for a fast,
      // minimal-reasoning extraction. The flag is forwarded into the request
      // body by the openai-compatible provider under its `deepseek` namespace.
      return { temperature: 0, providerOptions: { deepseek: { thinking: { type: "disabled" } } } };
  }
}

/**
 * Safety net over {@link prepareMediaForProvider}: by the time media reaches a
 * provider it should already be a form that provider accepts. This guards
 * against an unconverted PDF/image slipping through to a provider that can't read
 * it (extracted text is `text/plain`, which every provider accepts as a message).
 */
export function assertMediaSupported(input: Pick<DirectExtractInput, "mediaType" | "provider">): void {
  const config = getProviderConfig(input.provider);
  if (input.mediaType === "application/pdf" && !config.supportsPdfs) {
    throw new Error(`${config.label} does not support PDFs in Calendrino yet.`);
  }
  if (input.mediaType.startsWith("image/") && !config.supportsImages) {
    throw new Error(`${config.label} does not support images in Calendrino yet.`);
  }
}

function userContentFor(media: { bytes: Uint8Array; mediaType: string }): UserContent {
  // A PDF reduced to its text layer (for text-only providers like DeepSeek) is
  // sent inline as text — those providers reject file/image parts outright.
  if (media.mediaType === EXTRACTED_TEXT_MEDIA_TYPE) {
    const text = new TextDecoder().decode(media.bytes);
    return [{ type: "text", text: `Extract all calendar events from the following document text:\n\n${text}` }];
  }
  return [
    { type: "text", text: "Extract all calendar events from the attached file." },
    { type: "file", data: media.bytes, mediaType: media.mediaType },
  ];
}

export async function extractEventsDirect(input: DirectExtractInput): Promise<CalendarEvent[]> {
  const media = await prepareMediaForProvider(input);
  assertMediaSupported({ mediaType: media.mediaType, provider: input.provider });
  const modelId = resolveModelId(input);
  const { object } = await generateObject({
    model: modelFor(input, modelId),
    schema: EventsSchema,
    system: systemPrompt(input.now, input.customInstructions),
    ...callTuning(input.provider, modelId),
    messages: [{ role: "user", content: userContentFor(media) }],
  });
  return object.events;
}
