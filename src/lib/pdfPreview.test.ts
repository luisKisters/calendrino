import { readFile } from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { imagePreviewUrl, renderPdfFirstPage } from "./pdfPreview";

const mocks = vi.hoisted(() => ({
  getDocument: vi.fn(),
  globalWorkerOptions: { workerSrc: "" },
}));

vi.mock("pdfjs-dist/build/pdf.worker.mjs?url", () => ({
  default: "/assets/pdf.worker.mjs",
}));

vi.mock("pdfjs-dist", () => ({
  getDocument: mocks.getDocument,
  GlobalWorkerOptions: mocks.globalWorkerOptions,
}));

const originalToDataURL = HTMLCanvasElement.prototype.toDataURL;
const originalCreateObjectURL = URL.createObjectURL;

describe("pdfPreview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.globalWorkerOptions.workerSrc = "";
    HTMLCanvasElement.prototype.toDataURL = vi.fn(() => "data:image/png;base64,preview");
  });

  afterEach(() => {
    HTMLCanvasElement.prototype.toDataURL = originalToDataURL;
    URL.createObjectURL = originalCreateObjectURL;
  });

  it("renders the first PDF page to a data URL", async () => {
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const cleanup = vi.fn();
    const destroy = vi.fn(async () => undefined);
    const getPage = vi.fn(async () => ({
      cleanup,
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
      })),
      render,
    }));
    mocks.getDocument.mockReturnValue({
      destroy,
      promise: Promise.resolve({ destroy, getPage }),
    });
    const bytes = new Uint8Array(await readFile("src/test/fixtures/sample-event.pdf"));

    const dataUrl = await renderPdfFirstPage(bytes);

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(mocks.globalWorkerOptions.workerSrc).toBe("/assets/pdf.worker.mjs");
    expect(mocks.getDocument).toHaveBeenCalledWith({ data: expect.any(Uint8Array) });
    const [{ data }] = mocks.getDocument.mock.calls[0];
    expect(data).not.toBe(bytes);
    expect(getPage).toHaveBeenCalledWith(1);
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas: expect.any(HTMLCanvasElement),
        viewport: expect.objectContaining({ width: 1_200, height: 1_600 }),
      }),
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("caps preview rendering by page height for extreme aspect ratios", async () => {
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const cleanup = vi.fn();
    const destroy = vi.fn(async () => undefined);
    const getPage = vi.fn(async () => ({
      cleanup,
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 100_000 * scale,
      })),
      render,
    }));
    mocks.getDocument.mockReturnValue({
      destroy,
      promise: Promise.resolve({ destroy, getPage }),
    });

    const dataUrl = await renderPdfFirstPage(new Uint8Array([1, 2, 3]));

    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
    expect(render).toHaveBeenCalledWith(
      expect.objectContaining({
        canvas: expect.objectContaining({ width: 10, height: 1_600 }),
        viewport: expect.objectContaining({ width: 9.6, height: 1_600 }),
      }),
    );
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("rejects invalid PDF page dimensions before rendering", async () => {
    const render = vi.fn(() => ({ promise: Promise.resolve() }));
    const cleanup = vi.fn();
    const destroy = vi.fn(async () => undefined);
    const getPage = vi.fn(async () => ({
      cleanup,
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: Number.POSITIVE_INFINITY * scale,
        height: 800 * scale,
      })),
      render,
    }));
    mocks.getDocument.mockReturnValue({
      destroy,
      promise: Promise.resolve({ destroy, getPage }),
    });

    await expect(renderPdfFirstPage(new Uint8Array([1, 2, 3]))).rejects.toThrow("invalid dimensions");

    expect(render).not.toHaveBeenCalled();
    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("destroys the loading task when the PDF fails to load", async () => {
    const destroy = vi.fn(async () => undefined);
    mocks.getDocument.mockReturnValue({
      destroy,
      promise: Promise.reject(new Error("Bad PDF")),
    });
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(renderPdfFirstPage(bytes)).rejects.toThrow("Bad PDF");

    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("cleans up the page and destroys the loading task when rendering fails", async () => {
    const cleanup = vi.fn();
    const destroy = vi.fn(async () => undefined);
    const getPage = vi.fn(async () => ({
      cleanup,
      getViewport: vi.fn(({ scale }: { scale: number }) => ({
        width: 600 * scale,
        height: 800 * scale,
      })),
      render: vi.fn(() => ({ promise: Promise.reject(new Error("Render failed")) })),
    }));
    mocks.getDocument.mockReturnValue({
      destroy,
      promise: Promise.resolve({ destroy, getPage }),
    });
    const bytes = new Uint8Array([1, 2, 3]);

    await expect(renderPdfFirstPage(bytes)).rejects.toThrow("Render failed");

    expect(cleanup).toHaveBeenCalledTimes(1);
    expect(destroy).toHaveBeenCalledTimes(1);
  });

  it("creates an object URL for image files", () => {
    URL.createObjectURL = vi.fn(() => "blob:http://localhost/preview");
    const file = new File(["image"], "event.png", { type: "image/png" });

    expect(imagePreviewUrl(file)).toBe("blob:http://localhost/preview");
    expect(URL.createObjectURL).toHaveBeenCalledWith(file);
  });
});
