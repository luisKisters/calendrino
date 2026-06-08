import { expect, test } from "@playwright/test";

test("favicon link is served", async ({ page }) => {
  await page.goto("/");

  const favicon = page.locator('link[rel="icon"], link[rel="shortcut icon"]').first();
  await expect(favicon).toHaveAttribute("href");

  const href = await favicon.getAttribute("href");
  expect(href).toBeTruthy();

  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);
});

test("web manifest is served with riso theme color", async ({ page }) => {
  await page.goto("/");

  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute("href");

  const href = await manifestLink.getAttribute("href");
  expect(href).toBeTruthy();

  const response = await page.request.get(href!);
  expect(response.status()).toBe(200);

  const manifest = await response.json();
  expect(manifest.theme_color).toBe("#2A7E7B");
  expect(manifest.background_color).toBe("#F3E9D2");
  expect(manifest.name).toBe("Calendrino");
});

test("PWA icons are declared in manifest", async ({ page }) => {
  await page.goto("/");

  const manifestLink = page.locator('link[rel="manifest"]');
  const href = await manifestLink.getAttribute("href");
  const response = await page.request.get(href!);
  const manifest = await response.json();

  expect(manifest.icons).toBeInstanceOf(Array);
  expect(manifest.icons.length).toBeGreaterThanOrEqual(3);

  const sizes = manifest.icons.map((i: { sizes: string }) => i.sizes);
  expect(sizes).toContain("192x192");
  expect(sizes).toContain("512x512");
});
