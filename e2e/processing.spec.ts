import { expect, test } from "@playwright/test";

// Helper: reach the processing screen by injecting a settings key and
// stubbing /api/extract so it never resolves (keeps us on the processing screen).
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

  // Intercept /api/extract at network level so the request hangs permanently,
  // leaving the app on the Processing screen for the duration of the test.
  await page.route("**/api/extract", () => {
    // Never fulfill — request stays pending.
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();

  // Trigger the upload path via the file input
  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({
    name: "test.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-image-data"),
  });
}

test("processing screen shows riso skeleton and label", async ({ page }) => {
  await gotoProcessing(page);

  // Label is shown
  await expect(page.getByTestId("processing-label")).toBeVisible();

  // Thumbnail placeholder is rendered
  await expect(page.getByTestId("riso-thumb")).toBeVisible();

  // Skeleton rows are rendered (4 expected)
  const skels = page.getByTestId("riso-skel");
  await expect(skels).toHaveCount(4);
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
