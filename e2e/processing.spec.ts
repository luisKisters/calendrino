import { expect, test } from "@playwright/test";

async function installStreamingStub(page: import("@playwright/test").Page, complete = false) {
  await page.addInitScript(({ completeStream }) => {
    const originalFetch = window.fetch.bind(window);
    window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
      if (!url.includes("/api/extract-stream")) {
        return originalFetch(input, init);
      }

      const encoder = new TextEncoder();
      const timers: number[] = [];
      const signal = init?.signal;
      const stream = new ReadableStream<Uint8Array>({
        start(controller) {
          const send = (chunk: unknown) => {
            controller.enqueue(encoder.encode(`${JSON.stringify(chunk)}\n`));
          };
          const schedule = (delay: number, callback: () => void) => {
            timers.push(window.setTimeout(callback, delay));
          };
          const abort = () => {
            timers.forEach(window.clearTimeout);
            controller.error(new DOMException("Aborted", "AbortError"));
          };

          if (signal?.aborted) {
            abort();
            return;
          }
          signal?.addEventListener("abort", abort, { once: true });

          send({ kind: "status", text: "Reading the capture." });
          schedule(40, () => send({ kind: "found", text: "Found event: Board meeting" }));
          if (completeStream) {
            schedule(90, () => {
              send({
                kind: "done",
                events: [{
                  title: "Board meeting",
                  start: "2026-06-10T09:00:00",
                  end: null,
                  allDay: false,
                  location: null,
                  description: null,
                  timezone: null,
                  confidence: 0.9,
                }],
              });
              controller.close();
            });
          }
        },
        cancel() {
          timers.forEach(window.clearTimeout);
        },
      });

      return Promise.resolve(new Response(stream, {
        status: 200,
        headers: { "Content-Type": "application/x-ndjson" },
      }));
    };
  }, { completeStream: complete });
}

// Helper: reach the processing screen by injecting a settings key and stubbing
// /api/extract-stream with NDJSON chunks that keep the app on Processing.
async function gotoProcessing(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "aiSettings.v1",
      JSON.stringify({
        selectedProvider: "openai",
        providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      }),
    );
  });

  await installStreamingStub(page);

  await page.goto("/");
  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();

  // Trigger the upload path via the file input.
  const input = page.locator('input[accept="image/*,application/pdf"]');
  await input.setInputFiles({
    name: "test.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-image-data"),
  });
}

test("processing screen shows preview, agent label, and transcript", async ({ page }) => {
  await gotoProcessing(page);

  await expect(page.getByTestId("processing-label")).toHaveText("Agent is working");
  await expect(page.getByTestId("riso-thumb")).toBeVisible();
  await expect(page.getByTestId("agent-transcript")).toContainText("status / Reading the capture.");
  await expect(page.getByTestId("agent-transcript")).toContainText("found / Found event: Board meeting");

  const previewBackground = await page.getByTestId("processing-preview").evaluate((el) => {
    return getComputedStyle(el).backgroundImage;
  });
  expect(previewBackground).toContain("blob:");
});

test("processing screen Cancel returns to capture", async ({ page }) => {
  await gotoProcessing(page);

  await expect(page.getByTestId("riso-thumb")).toBeVisible();
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();
});

test("processing scan animation is disabled under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoProcessing(page);

  await expect(page.getByTestId("riso-scan")).toBeVisible();

  const animName = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='riso-scan']");
    if (!el) return null;
    return getComputedStyle(el).animationName;
  });

  // Global reduced-motion rule sets animation-name to "none"
  expect(animName).toBe("none");
});
