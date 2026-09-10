import { authenticatedTest, expect } from "./fixtures/authenticated";

authenticatedTest("muestra las preferencias de notificaciones sin solicitar permiso al cargar", async ({ authenticatedPage }) => {
  await authenticatedPage.goto("/perfil");

  await expect(authenticatedPage.getByRole("heading", { name: "Preferencias" })).toBeVisible();
  await expect(authenticatedPage.getByText(/Estado del navegador/)).toBeVisible();
  await expect(authenticatedPage.getByRole("button", { name: /Activar notificaciones|Desactivar notificaciones/ })).toBeVisible();
});
