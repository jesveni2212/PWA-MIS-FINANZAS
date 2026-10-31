import { authenticatedTest, expect } from "./fixtures/authenticated";
import { openMainNavigation } from "./fixtures/navigation";

authenticatedTest.describe("recordatorios", () => {
  authenticatedTest("muestra la navegación y los campos de repetición", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/recordatorios?x=1");

    await expect(authenticatedPage.getByRole("heading", { name: "Recordatorios" })).toBeVisible();
    const navigation = await openMainNavigation(authenticatedPage);
    await expect(navigation.getByRole("link", { name: "Recordatorios" })).toHaveAttribute("aria-current", "page");
    await expect(navigation.getByRole("link")).toHaveCount(7);
    if (await authenticatedPage.getByRole("dialog", { name: "Menú" }).isVisible()) await authenticatedPage.keyboard.press("Escape");

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
