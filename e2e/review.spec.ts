import { expect, test } from "@playwright/test";

const STUB_EVENT = {
  title: "Design review w/ Maya",
  start: "2026-06-12T15:00:00",
  end: "2026-06-12T16:00:00",
  allDay: false,
  location: "Studio B, 4th floor",
  description: null,
  timezone: null,
  confidence: 0.95,
};

const STUB_EVENT_2 = {
  title: "Team standup",
  start: "2026-06-12T09:00:00",
  end: "2026-06-12T09:30:00",
  allDay: false,
  location: null,
  description: null,
  timezone: null,
  confidence: 0.9,
};

// Navigate to the review screen using 2 events (avoids single-event auto-popup).
async function gotoReviewMulti(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "aiSettings.v1",
      JSON.stringify({
        selectedProvider: "openai",
        providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      }),
    );
  });

  await page.route("**/api/extract", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events: [STUB_EVENT, STUB_EVENT_2] }),
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

// Navigate to the review screen using 1 event (auto-popup suppressed).
async function gotoReviewSingle(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      "aiSettings.v1",
      JSON.stringify({
        selectedProvider: "openai",
        providers: { openai: { apiKey: "sk-test", model: "gpt-4.1" } },
      }),
    );
  });

  await page.route("**/api/extract", async (route) => {
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ events: [STUB_EVENT] }),
    });
  });

  await page.goto("/");
  // Suppress the auto-popup so Playwright doesn't block on it.
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
}

test("review screen shows riso event card", async ({ page }) => {
  await gotoReviewMulti(page);

  // Riso cards are rendered
  await expect(page.getByTestId("riso-event-card").first()).toBeVisible();

  // Title of first event is editable
  await expect(page.getByRole("textbox", { name: /event title/i }).first()).toHaveValue(
    "Design review w/ Maya",
  );

  // Mono field labels are visible
  await expect(page.getByText("DATE").first()).toBeVisible();
  await expect(page.getByText("TIME").first()).toBeVisible();
  await expect(page.getByText("LOCATION").first()).toBeVisible();
});

test("review screen Add to Google Calendar opens calendar", async ({ page }) => {
  await gotoReviewMulti(page);

  await expect(page.getByTestId("riso-event-card").first()).toBeVisible();

  const addBtn = page.getByRole("button", { name: /add to google calendar/i }).first();
  await expect(addBtn).toBeVisible();

  // Handle the popup that window.open triggers.
  const popupPromise = page.waitForEvent("popup").catch(() => null);
  await addBtn.click();
  await popupPromise;

  // After clicking, button text changes to "Opened — open again".
  await expect(page.getByRole("button", { name: /opened/i }).first()).toBeVisible();
});

test("review screen New capture button returns to capture", async ({ page }) => {
  await gotoReviewMulti(page);

  await expect(page.getByTestId("riso-event-card").first()).toBeVisible();

  await page.getByRole("button", { name: /new capture/i }).click();

  await expect(page.getByRole("button", { name: /take photo/i })).toBeVisible();
});

test("review screen heading is Review event for single event", async ({ page }) => {
  await gotoReviewSingle(page);

  await expect(page.getByRole("heading", { name: /review event/i })).toBeVisible();
  await expect(page.getByTestId("riso-event-card")).toBeVisible();
});
