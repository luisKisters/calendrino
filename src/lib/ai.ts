import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { generateObject } from "ai";
import { EventsSchema, type CalendarEvent } from "./schema";
import { aiFetch } from "./platform";
import type { NowContext } from "./datetime";

// Gemini 3.1 Pro. `gemini-3-pro-preview` was retired 2026-03-26; use 3.1.
const MODEL_ID = "gemini-3.1-pro-preview";

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
  apiKey: string;
  now: NowContext;
}

/** Send the captured file to Gemini and return the structured events it finds. */
export async function extractEvents(input: ExtractInput): Promise<CalendarEvent[]> {
  const google = createGoogleGenerativeAI({ apiKey: input.apiKey, fetch: aiFetch });
  const { object } = await generateObject({
    model: google(MODEL_ID),
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
