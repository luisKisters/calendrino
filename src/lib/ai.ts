import type { CalendarEvent } from "./schema";
import { aiFetch, isTauri } from "./platform";
import type { NowContext } from "./datetime";
import type { AiProviderId } from "./aiProviders";
import { extractEventsDirect, streamExtractionDirect } from "./aiCore";
import { ExtractResponsePayloadSchema, type ExtractRequestPayload } from "./aiContract";
import { parseTranscriptChunk, type TranscriptChunk } from "./transcript";

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
  const payload = extractPayload(input);
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

function extractPayload(input: ExtractInput): ExtractRequestPayload {
  return {
    mediaBase64: bytesToBase64(input.bytes),
    mediaType: input.mediaType,
    provider: input.provider,
    apiKey: input.apiKey,
    model: input.model,
    instructions: input.instructions,
    now: input.now,
  };
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

export async function* streamExtraction(input: ExtractInput, signal?: AbortSignal): AsyncIterable<TranscriptChunk> {
  if (isTauri()) {
    yield* streamExtractionDirect({ ...input, fetch: aiFetch, abortSignal: signal });
    return;
  }
  yield* streamExtractionViaProxy(input, signal);
}

async function* streamExtractionViaProxy(input: ExtractInput, signal?: AbortSignal): AsyncIterable<TranscriptChunk> {
  const response = await fetch("/api/extract-stream", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(extractPayload(input)),
    signal,
  });

  if (!response.body) {
    throw new Error(`AI extraction failed with HTTP ${response.status}.`);
  }

  let yielded = false;
  for await (const chunk of parseTranscriptNdjson(response.body)) {
    yielded = true;
    yield chunk;
  }

  if (!response.ok && !yielded) {
    throw new Error(`AI extraction failed with HTTP ${response.status}.`);
  }
}

export async function* parseTranscriptNdjson(stream: ReadableStream<Uint8Array>): AsyncIterable<TranscriptChunk> {
  const reader = stream.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed) yield parseTranscriptChunk(JSON.parse(trimmed));
      }
    }

    buffer += decoder.decode();
    const tail = buffer.trim();
    if (tail) yield parseTranscriptChunk(JSON.parse(tail));
  } finally {
    reader.releaseLock();
  }
}
