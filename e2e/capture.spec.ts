import { expect, test } from "@playwright/test";

test("capture screen shows riso logo and heading", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "aiSettings.v1",
      JSON.stringify({
        selectedProvider: "openai",
        providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      }),
    );
  });
  await page.goto("/");

  // Logo is rendered (via Logo component — aria-hidden span)
  const heading = page.getByRole("heading", { name: "Calendrino", exact: true });
  await expect(heading).toBeVisible();

  // Capture zone headline
  await expect(page.getByText("Snap or drop")).toBeVisible();

  // Primary action button
  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();

  // Secondary action button
  await expect(page.getByRole("button", { name: /upload file/i })).toBeVisible();
});

test("capture screen gear button opens settings", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem(
      "aiSettings.v1",
      JSON.stringify({
        selectedProvider: "openai",
        providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      }),
    );
  });
  await page.goto("/");

  // Wait for capture screen
  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();

  // Click settings gear
  await page.getByRole("button", { name: /settings/i }).click();

  // Settings screen should appear
  await expect(page.getByText("Welcome to Calendrino").or(page.getByLabel("AI provider"))).toBeVisible();
});

test("mobile safe-area: header is visible and not clipped", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile safe-area smoke test");

  await page.goto("/");
  const title = page.getByRole("heading", { name: "Calendrino", exact: true });
  await expect(title).toBeVisible();

  const box = await title.boundingBox();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
});
