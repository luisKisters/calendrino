import type { VercelRequest, VercelResponse } from "@vercel/node";
import { streamExtractionDirect } from "../src/lib/aiCore.js";
import { ExtractRequestPayloadSchema } from "../src/lib/aiContract.js";
import type { TranscriptChunk } from "../src/lib/transcript.js";
import { decodeMedia, MAX_BASE64_CHARS, MAX_MEDIA_BYTES, readJsonBody } from "./extract.js";

function writeHeaders(res: VercelResponse, status: number): void {
  res.status(status);
  res.setHeader("Content-Type", "application/x-ndjson; charset=utf-8");
  res.setHeader("Cache-Control", "no-cache, no-transform");
}

function writeChunk(res: VercelResponse, chunk: TranscriptChunk): void {
  res.write(`${JSON.stringify(chunk)}\n`);
}

function writeError(res: VercelResponse, status: number, message: string): void {
  writeHeaders(res, status);
  writeChunk(res, { kind: "error", message });
  res.end();
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    writeError(res, 405, "Method not allowed.");
    return;
  }

  const parsed = ExtractRequestPayloadSchema.safeParse(readJsonBody(req.body));
  if (!parsed.success) {
    writeError(res, 400, "Invalid extraction request.");
    return;
  }

  if (parsed.data.mediaBase64.length > MAX_BASE64_CHARS) {
    writeError(res, 413, "Uploaded file is too large.");
    return;
  }

  const bytes = decodeMedia(parsed.data.mediaBase64);
  if (bytes.byteLength > MAX_MEDIA_BYTES) {
    writeError(res, 413, "Uploaded file is too large.");
    return;
  }

  writeHeaders(res, 200);
  const disconnect = disconnectSignal(req, res);
  try {
    for await (const chunk of streamExtractionDirect({
      bytes,
      mediaType: parsed.data.mediaType,
      provider: parsed.data.provider,
      apiKey: parsed.data.apiKey,
      model: parsed.data.model,
      instructions: parsed.data.instructions,
      now: parsed.data.now,
      fetch: globalThis.fetch.bind(globalThis),
      abortSignal: disconnect.signal,
    })) {
      writeChunk(res, chunk);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI extraction failed.";
    writeChunk(res, { kind: "error", message });
  } finally {
    disconnect.cleanup();
    res.end();
  }
}

function disconnectSignal(req: VercelRequest, res: VercelResponse): { signal: AbortSignal; cleanup: () => void } {
  const abortController = new AbortController();
  const abort = () => abortController.abort();
  req.on("aborted", abort);
  res.on("close", abort);
  return {
    signal: abortController.signal,
    cleanup: () => {
      req.off("aborted", abort);
      res.off("close", abort);
    },
  };
}
