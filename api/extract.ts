import type { VercelRequest, VercelResponse } from "@vercel/node";
import { extractEventsDirect } from "../src/lib/aiCore";
import { ExtractRequestPayloadSchema } from "../src/lib/aiContract";

const MAX_MEDIA_BYTES = 12 * 1024 * 1024;
const MAX_BASE64_CHARS = Math.ceil((MAX_MEDIA_BYTES * 4) / 3) + 4;

function jsonError(res: VercelResponse, status: number, error: string): void {
  res.status(status).json({ error });
}

function decodeMedia(mediaBase64: string): Uint8Array {
  return Uint8Array.from(Buffer.from(mediaBase64, "base64"));
}

export default async function handler(req: VercelRequest, res: VercelResponse): Promise<void> {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    jsonError(res, 405, "Method not allowed.");
    return;
  }

  const parsed = ExtractRequestPayloadSchema.safeParse(req.body);
  if (!parsed.success) {
    jsonError(res, 400, "Invalid extraction request.");
    return;
  }

  if (parsed.data.mediaBase64.length > MAX_BASE64_CHARS) {
    jsonError(res, 413, "Uploaded file is too large.");
    return;
  }

  try {
    const bytes = decodeMedia(parsed.data.mediaBase64);
    if (bytes.byteLength > MAX_MEDIA_BYTES) {
      jsonError(res, 413, "Uploaded file is too large.");
      return;
    }

    const events = await extractEventsDirect({
      bytes,
      mediaType: parsed.data.mediaType,
      provider: parsed.data.provider,
      apiKey: parsed.data.apiKey,
      model: parsed.data.model,
      now: parsed.data.now,
      fetch: globalThis.fetch.bind(globalThis),
    });
    res.status(200).json({ events });
  } catch (error) {
    const message = error instanceof Error ? error.message : "AI extraction failed.";
    jsonError(res, 500, message);
  }
}
