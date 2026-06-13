import type { CalendarEvent } from "./schema";
import { aiFetch, isTauri } from "./platform";
import type { NowContext } from "./datetime";
import type { AiProviderId } from "./aiProviders";
import { extractEventsDirect } from "./aiCore";
import { ExtractResponsePayloadSchema, type ExtractRequestPayload } from "./aiContract";

export interface ExtractInput {
  bytes: Uint8Array;
  mediaType: string;
  provider: AiProviderId;
  apiKey: string;
  model?: string;
  instructions?: string;
  now: NowContext;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

async function extractEventsViaProxy(input: ExtractInput): Promise<CalendarEvent[]> {
  const payload: ExtractRequestPayload = {
    mediaBase64: bytesToBase64(input.bytes),
    mediaType: input.mediaType,
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    instructions: input.instructions,
    now: input.now,
  };
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      body && typeof body === "object" && "error" in body && typeof body.error === "string"
        ? body.error
        : `AI extraction failed with HTTP ${response.status}.`;
    throw new Error(message);
  }
  return ExtractResponsePayloadSchema.parse(body).events;
}

/**
 * Send the captured file to the selected AI provider and return structured
 * events. Media is normalised for the provider inside the extraction call
 * (see prepareMediaForProvider), so PDFs work on every provider — natively where
 * supported, via text extraction for the text-only ones.
 */
export async function extractEvents(input: ExtractInput): Promise<CalendarEvent[]> {
  if (isTauri()) {
    return extractEventsDirect({ ...input, fetch: aiFetch });
  }
  return extractEventsViaProxy(input);
}
