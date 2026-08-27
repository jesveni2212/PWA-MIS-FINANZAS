import { expect, test } from "@playwright/test";

const destinations = [
  { label: "Iniciar sesión", path: "/acceso" },
  { label: "Quiero ser cliente", path: "/registro" },
];

test("public navigation reaches each access destination", async ({ page }) => {
  for (const destination of destinations) {
    await page.goto("/");
    await page.getByRole("link", { name: destination.label }).click();

    await expect(page).toHaveURL(new RegExp(`${destination.path}$`));
    await expect(page.getByRole("heading", { level: 1 })).toHaveText(destination.label);
  }
});
for (const path of ["/perfil", "/movimientos", "/grupos"]) {
  test(`${path} redirects anonymous users to access with an internal return path`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/acceso\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Iniciar sesión");
  });
}

