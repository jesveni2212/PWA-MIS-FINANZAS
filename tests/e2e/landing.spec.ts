import { expect, test } from "@playwright/test";

test("renders the public shell", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("heading", { name: "Una base clara para tus finanzas." })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});

test("serves the PWA manifest", async ({ page }) => {
  const response = await page.goto("/manifest.webmanifest");

  expect(response?.ok()).toBe(true);
});
