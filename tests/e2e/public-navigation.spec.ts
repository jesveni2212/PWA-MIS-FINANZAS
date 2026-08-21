import { expect, test } from "@playwright/test";

const destinations = [
  { label: "Movimientos", path: "/movimientos" },
  { label: "Grupos", path: "/grupos" },
  { label: "Perfil", path: "/perfil" },
];

test("public navigation reaches each available destination", async ({ page }) => {
  for (const destination of destinations) {
    await page.goto("/");
    await page.getByRole("link", { name: destination.label }).click();

    await expect(page).toHaveURL(destination.path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(destination.label);
  }
});
