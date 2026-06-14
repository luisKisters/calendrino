import pdfWorkerSrc from "pdfjs-dist/build/pdf.worker.mjs?url";

const MAX_PREVIEW_WIDTH = 1_200;
const MAX_RENDER_SCALE = 2;
const MIN_RENDER_SCALE = 0.25;

type PdfJsModule = typeof import("pdfjs-dist");

async function loadPdfJs(): Promise<PdfJsModule> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = pdfWorkerSrc;
  return pdfjs;
}

function previewScale(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1;
  return Math.max(MIN_RENDER_SCALE, Math.min(MAX_RENDER_SCALE, MAX_PREVIEW_WIDTH / width));
}

export async function renderPdfFirstPage(bytes: Uint8Array): Promise<string> {
  const pdfjs = await loadPdfJs();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes) });
  const pdf = await loadingTask.promise;

  try {
    const page = await pdf.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const viewport = page.getViewport({ scale: previewScale(baseViewport.width) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.ceil(viewport.width));
    canvas.height = Math.max(1, Math.ceil(viewport.height));

    await page.render({ canvas, viewport }).promise;
    page.cleanup();

    return canvas.toDataURL("image/png");
  } finally {
    await loadingTask.destroy();
  }
}

export function imagePreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
