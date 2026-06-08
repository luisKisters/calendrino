import { expect, test } from "@playwright/test";

// Navigate to the error screen by stubbing /api/extract to return 401.
async function gotoAuthError(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "aiSettings.v1",
      JSON.stringify({
        selectedProvider: "openai",
        providers: { openai: { apiKey: "sk-bad", model: "gpt-4.1" } },
      }),
    );
  });

  await page.route("**/api/extract", async (route) => {
    await route.fulfill({
      status: 401,
      contentType: "application/json",
      body: JSON.stringify({ error: "401: Invalid API key" }),
    });
  });

  await page.goto("/");
  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({
    name: "test.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-image-data"),
  });
}

test("error screen shows riso error panel with retry and settings buttons", async ({ page }) => {
  await gotoAuthError(page);

  // Error panel is rendered
  await expect(page.getByTestId("riso-error")).toBeVisible();

  // Friendly error message
  await expect(page.getByText(/couldn't authenticate/i)).toBeVisible();

  // Retry button
  await expect(page.getByRole("button", { name: /try again/i })).toBeVisible();

  // Settings button
  await expect(page.getByRole("button", { name: /open settings/i })).toBeVisible();
});

test("error screen retry returns to capture", async ({ page }) => {
  await gotoAuthError(page);

  await expect(page.getByTestId("riso-error")).toBeVisible();
  await page.getByRole("button", { name: /try again/i }).click();
  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();
});

test("error screen settings button opens settings", async ({ page }) => {
  await gotoAuthError(page);

  await expect(page.getByTestId("riso-error")).toBeVisible();
  await page.getByRole("button", { name: /open settings/i }).click();

  // Settings screen shown
  await expect(page.getByLabel("AI provider")).toBeVisible();
});

test("error screen contains no emoji glyphs", async ({ page }) => {
  await gotoAuthError(page);

  await expect(page.getByTestId("riso-error")).toBeVisible();

  // Check the entire page body for emoji characters (Unicode emoji ranges)
  const bodyText = await page.locator("body").innerText();
  // Emoji block: U+1F300–U+1FAFF and common emoji ranges
  const emojiRegex =
    /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FEFF}\u{1F900}-\u{1F9FF}]/u;
  expect(emojiRegex.test(bodyText)).toBe(false);
});

test("error screen animations are off under prefers-reduced-motion", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await gotoAuthError(page);

  await expect(page.getByTestId("riso-error")).toBeVisible();

  // Verify the global reduced-motion rule is active — sample one element
  const animName = await page.evaluate(() => {
    const el = document.querySelector("[data-testid='riso-error']");
    if (!el) return null;
    return getComputedStyle(el).animationName;
  });

  // Under reduced-motion, animation-name is "none"
  expect(animName).toBe("none");
});
