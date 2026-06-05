import { expect, test } from "@playwright/test";

test("settings supports OpenRouter Kimi default and editable model", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByText("Welcome to Calendrino")).toBeVisible();
  await page.getByLabel("AI provider").selectOption("openrouter");
  await expect(page.getByLabel("OpenRouter API key")).toBeVisible();
  await expect(page.getByLabel("Model")).toHaveValue("moonshotai/kimi-k2.6");

  await page.getByLabel("Model").fill("openai/gpt-4.1");
  await expect(page.getByLabel("Model")).toHaveValue("openai/gpt-4.1");
  await page.getByRole("button", { name: "Reset to default" }).click();
  await expect(page.getByLabel("Model")).toHaveValue("moonshotai/kimi-k2.6");
});

test("header is visible in mobile viewport", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile safe-area smoke test");

  await page.goto("/");
  const title = page.getByRole("heading", { name: "Calendrino", exact: true });
  await expect(title).toBeVisible();

  const box = await title.boundingBox();
  expect(box?.y ?? -1).toBeGreaterThanOrEqual(0);
});
