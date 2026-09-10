import { expect, test } from "@playwright/test";

test("las rutas públicas de acceso y registro son navegables", async ({ page }) => {
  await page.goto("/acceso");
  await expect(page).toHaveURL(/\/acceso$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Iniciar sesión");

  await page.getByRole("link", { name: "Quiero ser cliente" }).click();
  await expect(page).toHaveURL(/\/registro$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Quiero ser cliente");

  await page.getByRole("link", { name: "Iniciar sesión" }).click();
  await expect(page).toHaveURL(/\/acceso$/);
});

for (const path of ["/cuentas", "/movimientos", "/grupos", "/recordatorios", "/perfil"]) {
  test(`${path} redirige usuarios anónimos al acceso`, async ({ page }) => {
    await page.goto(path);

    await expect(page).toHaveURL(/\/acceso\?next=/);
    expect(new URL(page.url()).searchParams.get("next")).toBe(path);
    await expect(page.getByRole("heading", { level: 1 })).toHaveText("Iniciar sesión");
  });
}
