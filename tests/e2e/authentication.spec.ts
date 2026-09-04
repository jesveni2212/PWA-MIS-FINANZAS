import { expect, test } from "@playwright/test";

test.describe("autenticación", () => {
  test("muestra el acceso y conserva la ruta interna solicitada", async ({ page }) => {
    await page.goto("/acceso?next=%2Fperfil");
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await expect(page.locator('input[name="next"]')).toHaveValue("/perfil");
  });

  test("permite recorrer registro y recuperación", async ({ page }) => {
    await page.goto("/registro");
    await expect(page.getByLabel("Correo electrónico")).toBeVisible();
    await expect(page.getByLabel("Contraseña")).toBeVisible();
    await page.getByRole("link", { name: "Iniciar sesión" }).click();
    await expect(page).toHaveURL(/\/acceso$/);
    await page.getByRole("link", { name: "Recuperar contraseña" }).click();
    await expect(page).toHaveURL(/\/recuperar-contrasena$/);
    await expect(page.getByRole("button", { name: "Enviar instrucciones" })).toBeVisible();
  });
});
