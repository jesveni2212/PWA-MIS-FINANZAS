import { authenticatedTest, expect } from "./fixtures/authenticated";

authenticatedTest.describe("recordatorios", () => {
  authenticatedTest("muestra la navegación y los campos de repetición", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/recordatorios?x=1");

    await expect(authenticatedPage.getByRole("heading", { name: "Recordatorios" })).toBeVisible();
    await expect(authenticatedPage.getByRole("link", { name: "Recordatorios" })).toHaveAttribute("aria-current", "page");
    await expect(authenticatedPage.getByRole("navigation", { name: /Navegación principal/ }).getByRole("link")).toHaveCount(6);

    await authenticatedPage.getByRole("button", { name: "Nuevo recordatorio" }).click();
    await expect(authenticatedPage.getByLabel("Repetición")).toHaveValue("monthly");
    await expect(authenticatedPage.getByLabel("Día del mes")).toBeVisible();

    await authenticatedPage.getByLabel("Repetición").selectOption("weekly");
    await expect(authenticatedPage.getByLabel("Día de la semana")).toBeVisible();
    await authenticatedPage.getByLabel("Repetición").selectOption("annual");
    await expect(authenticatedPage.getByLabel("Mes")).toBeVisible();
    await authenticatedPage.getByLabel("Repetición").selectOption("custom");
    await expect(authenticatedPage.getByLabel("Unidad")).toBeVisible();
  });
});
