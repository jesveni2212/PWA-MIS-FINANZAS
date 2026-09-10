import { expect, test } from "@playwright/test";

test("protege la portada para visitantes anónimos", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveURL(/\/acceso(?:\?.*)?$/);
});

test("sirve el manifest de la PWA", async ({ page }) => {
  const response = await page.goto("/manifest.webmanifest");

  expect(response?.ok()).toBe(true);
});
