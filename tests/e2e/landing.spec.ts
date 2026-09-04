import { expect, test } from "@playwright/test";

test("renderiza el shell y la navegación principal", async ({ page }) => {
  await page.goto("/");

  await expect(page.getByRole("navigation", { name: "Navegación principal" })).toBeVisible();
});

test("sirve el manifest de la PWA", async ({ page }) => {
  const response = await page.goto("/manifest.webmanifest");

  expect(response?.ok()).toBe(true);
});
