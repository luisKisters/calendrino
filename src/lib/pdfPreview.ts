import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

const MAX_PREVIEW_WIDTH = 1_200;
const MAX_PREVIEW_HEIGHT = 1_600;
const MAX_PREVIEW_PIXELS = MAX_PREVIEW_WIDTH * MAX_PREVIEW_HEIGHT;
const MAX_RENDER_SCALE = 2;

type PdfJsModule = typeof import("pdfjs-dist");

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  return pdfjs;
}

function previewScale(width: number, height: number): number {
  assertPositiveFiniteDimension(width);
  assertPositiveFiniteDimension(height);

  const scale = Math.min(
    MAX_RENDER_SCALE,
    MAX_PREVIEW_WIDTH / width,
    MAX_PREVIEW_HEIGHT / height,
    Math.sqrt(MAX_PREVIEW_PIXELS / (width * height)),
  );
  if (!Number.isFinite(scale) || scale <= 0) {
    throw new Error("PDF page is too large to preview safely.");
  }
  return scale;
}

function assertPositiveFiniteDimension(value: number): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error("PDF page has invalid dimensions.");
  }
}

function assertSafeCanvasDimensions(width: number, height: number): void {
  assertPositiveFiniteDimension(width);
  assertPositiveFiniteDimension(height);
  if (width > MAX_PREVIEW_WIDTH || height > MAX_PREVIEW_HEIGHT || width * height > MAX_PREVIEW_PIXELS) {
    throw new Error("PDF page is too large to preview safely.");
  }
}

export async function renderPdfFirstPage(bytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });

  try {
    const pdf = await loadingTask.promise;
    const page = await pdf.getPage(1);
    try {
      const baseViewport = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: previewScale(baseViewport.width, baseViewport.height) });
      const width = Math.max(1, Math.ceil(viewport.width));
      const height = Math.max(1, Math.ceil(viewport.height));
      assertSafeCanvasDimensions(width, height);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;

      await page.render({ canvas, viewport }).promise;

      return canvas.toDataURL("image/png");
    } finally {
      page.cleanup();
    }
  } finally {
    await loadingTask.destroy();
  }
}

export function imagePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
