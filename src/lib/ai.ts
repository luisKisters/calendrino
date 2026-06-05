import { createAnthropic } from "@ai-sdk/anthropic";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import { generateObject } from "ai";
import { EventsSchema, type CalendarEvent } from "./schema";
import { aiFetch } from "./platform";
import type { NowContext } from "./datetime";
import { getProviderConfig, type AiProviderId } from "./aiProviders";

function systemPrompt(now: NowContext): string {
  return [
    "You extract calendar events from the provided image, PDF, or audio.",
    `Today is ${now.isoDate} (${now.weekday}); the user's timezone is ${now.tz}.`,
    "Identify every distinct event and return it as structured data. Rules:",
    '- Resolve relative dates ("tomorrow", "next Friday") against today.',
    "- Use local wall-clock ISO 8601 WITHOUT any timezone suffix for start/end",
    "  (e.g. 2026-06-12T19:30:00). For all-day events use a date only (2026-06-12).",
    "- If no end time is stated, set end to null.",
    "- Set allDay=true only for date-only events with no specific time.",
    "- Set timezone (IANA, e.g. Europe/Berlin) ONLY if the source explicitly implies",
    "  a specific timezone (e.g. a flight or a webinar in another city); otherwise null.",
    "- Never invent details. Use null for anything not clearly present.",
    "- confidence is your 0..1 certainty that this is a real, schedulable event.",
    "- If there are no events at all, return an empty events array.",
  ].join("\n");
}

export interface ExtractInput {
  bytes: Uint8Array;
  mediaType: string;
  provider: AiProviderId;
  apiKey: string;
  model?: string;
  now: NowContext;
}

function modelFor(input: ExtractInput) {
  const modelId = input.model?.trim() || getProviderConfig(input.provider).defaultModel;
  switch (input.provider) {
    case "gemini": {
      const google = createGoogleGenerativeAI({ apiKey: input.apiKey, fetch: aiFetch });
      return google(modelId);
    }
    case "anthropic": {
      const anthropic = createAnthropic({ apiKey: input.apiKey, fetch: aiFetch });
      return anthropic(modelId);
    }
    case "openai": {
      const openai = createOpenAI({ apiKey: input.apiKey, fetch: aiFetch });
      return openai(modelId);
    }
    case "openrouter": {
      const openrouter = createOpenAICompatible({
        name: "openrouter",
        apiKey: input.apiKey,
        baseURL: "https://openrouter.ai/api/v1",
        fetch: aiFetch,
      });
      return openrouter(modelId);
    }
  }
}

function assertMediaSupported(input: ExtractInput): void {
  const config = getProviderConfig(input.provider);
  if (input.mediaType === "application/pdf" && !config.supportsPdfs) {
    throw new Error(`${config.label} does not support PDFs in Calendrino yet. Use Gemini or OpenRouter for PDFs.`);
  }
  if (input.mediaType.startsWith("image/") && !config.supportsImages) {
    throw new Error(`${config.label} does not support images in Calendrino yet.`);
  }
}

/** Send the captured file to the selected AI provider and return structured events. */
export async function extractEvents(input: ExtractInput): Promise<CalendarEvent[]> {
  assertMediaSupported(input);
  const { object } = await generateObject({
    model: modelFor(input),
    schema: EventsSchema,
    system: systemPrompt(input.now),
    messages: [
      {
        role: "user",
        content: [
          { type: "text", text: "Extract all calendar events from the attached file." },
          { type: "file", data: input.bytes, mediaType: input.mediaType },
        ],
      },
    ],
  });
  return object.events;
}
