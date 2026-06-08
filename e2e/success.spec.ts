import { expect, test } from "@playwright/test";

const STUB_EVENT = {
  title: "Board meeting",
  start: "2026-06-12T14:00:00",
  end: "2026-06-12T15:00:00",
  allDay: false,
  location: "Room 4B",
  description: null,
  timezone: null,
  confidence: 0.95,
};

async function gotoSuccess(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "aiSettings.v1",
      JSON.stringify({
        selectedProvider: "openai",
        providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      }),
    );
  });

  // Use 2 events to avoid auto-open; user manually clicks add for one.
  await page.route("**/api/extract", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events: [STUB_EVENT] }),
    });
  });

  // Suppress the auto-popup for the single-event auto-open.
  await page.goto("/");
  await page.evaluate(() => {
    window.open = () => null;
  });

  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();

  const input = page.locator('input[type="file"]').first();
  await input.setInputFiles({
    name: "test.jpg",
    mimeType: "image/jpeg",
    buffer: Buffer.from("fake-image-data"),
  });

  // Wait for review screen.
  await expect(page.getByTestId("riso-event-card")).toBeVisible();

  // Click add (suppress resulting popup too).
  await page.evaluate(() => { window.open = () => null; });
  await page.getByRole("button", { name: /add to google calendar/i }).click();
}

test("success screen shows stamp, heading, and ticket after adding", async ({ page }) => {
  await gotoSuccess(page);

  await expect(page.getByRole("heading", { name: /added to calendar/i })).toBeVisible();
  await expect(page.getByTestId("success-ticket")).toBeVisible();
  await expect(page.getByText("Board meeting")).toBeVisible();
});

test("success screen Capture another returns to capture", async ({ page }) => {
  await gotoSuccess(page);

  await expect(page.getByRole("heading", { name: /added to calendar/i })).toBeVisible();
  await page.getByRole("button", { name: /capture another/i }).click();
  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();
});
