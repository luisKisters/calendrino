import { getProviderConfig, type AiProviderId } from "./aiProviders.js";

const PDF_MEDIA_TYPE = "application/pdf";
/** Marker media type for a PDF whose text layer we extracted client-side. */
export const EXTRACTED_TEXT_MEDIA_TYPE = "text/plain";

/** Thrown when a capture can't be made readable for the chosen provider. */
export class MediaPrepError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "MediaPrepError";
  }
}

export interface MediaPrepInput {
  bytes: Uint8Array;
  mediaType: string;
  provider: AiProviderId;
}

export interface PreparedMedia {
  bytes: Uint8Array;
  mediaType: string;
}

async function pdfToText(bytes: Uint8Array): Promise<string> {
  // unpdf bundles a runtime-agnostic pdf.js (Node, browser, edge) with no worker
  // setup, so this same path works in the Vercel function, the PWA, and the Tauri
  // (Android) webview. getDocumentProxy consumes its buffer, so pass a copy to
  // keep the caller's bytes intact.
  const { extractText, getDocumentProxy } = await import("unpdf");
  const pdf = await getDocumentProxy(new Uint8Array(bytes));
  const { text } = await extractText(pdf, { mergePages: true });
  return text.trim();
}

/**
 * Make a capture readable for the chosen provider.
 *
 * Every provider except DeepSeek reads PDFs and images natively, so their bytes
 * pass straight through. DeepSeek is text-only, so a PDF is reduced to its text
 * layer (returned as `text/plain` and sent as a plain text message, not a file
 * part, which DeepSeek rejects). A photo bound for DeepSeek would need OCR, which
 * we don't bundle, so it's rejected with a clear message instead.
 */
export async function prepareMediaForProvider(input: MediaPrepInput): Promise<PreparedMedia> {
  const config = getProviderConfig(input.provider);
  const { bytes, mediaType } = input;

  if (mediaType === PDF_MEDIA_TYPE && !config.supportsPdfs) {
    if (config.supportsImages) {
      // An image-capable provider with no native PDF support would rasterise the
      // PDF to an image here. No active provider needs that (image models read
      // PDFs directly), so reaching this branch is a misconfiguration.
      throw new MediaPrepError(
        `${config.label} can't read PDFs directly. Use Gemini, Anthropic, OpenAI, OpenRouter, or Weights & Biases for PDFs.`,
      );
    }
    const text = await pdfToText(bytes);
    if (!text) {
      throw new MediaPrepError(
        `Couldn't read any text from this PDF for ${config.label}. It looks like a scan without a text layer — try a PDF-capable provider such as Gemini.`,
      );
    }
    return { bytes: new TextEncoder().encode(text), mediaType: EXTRACTED_TEXT_MEDIA_TYPE };
  }

  if (mediaType.startsWith("image/") && !config.supportsImages) {
    throw new MediaPrepError(
      `${config.label} can't read images. Capture a PDF instead, or choose a provider with image support.`,
    );
  }

  return { bytes, mediaType };
}
