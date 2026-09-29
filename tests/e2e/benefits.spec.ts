import { authenticatedTest, expect } from "./fixtures/authenticated";

const weekdayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function dateParts() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const day = String(now.getUTCDate()).padStart(2, "0");
  const monthValue = String(month + 1).padStart(2, "0");
  const periodStart = `${year}-${monthValue}-01`;
  const periodEnd = new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10);
  const nextMonthStart = new Date(Date.UTC(year, month + 1, 1)).toISOString().slice(0, 10);
  const nextMonthEnd = new Date(Date.UTC(year, month + 2, 0)).toISOString().slice(0, 10);
  const occurredOn = `${year}-${monthValue}-${day}`;
  const weekday = new Date(`${occurredOn}T00:00:00.000Z`).getUTCDay();
  return { periodStart, periodEnd, nextMonthStart, nextMonthEnd, occurredOn, weekday };
}

authenticatedTest.describe("beneficios de tarjetas", () => {
  authenticatedTest("navega a beneficios y muestra el estado de tarjetas", async ({ authenticatedPage }) => {
    await authenticatedPage.goto("/beneficios");

    await expect(authenticatedPage.getByRole("heading", { name: "Beneficios" })).toBeVisible();
    await expect(authenticatedPage.getByRole("navigation", { name: "Navegación principal" }).getByRole("link", { name: "Beneficios" })).toHaveAttribute("aria-current", "page");
    await expect(authenticatedPage.getByLabel("Período")).toBeVisible();

    const emptyState = authenticatedPage.getByText("Todavía no registraste tarjetas de crédito", { exact: true });
    if (await emptyState.isVisible()) {
      await expect(authenticatedPage.getByRole("link", { name: "Registrar tarjeta" })).toHaveAttribute("href", "/cuentas");
    } else {
      await expect(authenticatedPage.getByRole("button", { name: "Nuevo beneficio" })).toBeVisible();
    }
  });

  authenticatedTest("cubre el estado vacío cuando el usuario no tiene tarjeta", async ({ authenticatedPage }, testInfo) => {
    await authenticatedPage.goto("/beneficios");
    const emptyState = authenticatedPage.getByText("Todavía no registraste tarjetas de crédito", { exact: true });
    testInfo.skip(!(await emptyState.isVisible()), "La cuenta E2E tiene una tarjeta de crédito sembrada.");
    await expect(emptyState).toBeVisible();
    await expect(authenticatedPage.getByRole("link", { name: "Registrar tarjeta" })).toHaveAttribute("href", "/cuentas");
  });

  authenticatedTest("configura un beneficio, calcula compras y actualiza sus topes", async ({ authenticatedPage }, testInfo) => {
    const dates = dateParts();
    const merchant = `E2E beneficio ${testInfo.project.name} ${testInfo.workerIndex} ${Date.now()}`;

    await authenticatedPage.goto("/beneficios");
    await authenticatedPage.getByRole("button", { name: "Nuevo beneficio" }).click();
    const cardSelect = authenticatedPage.getByLabel("Tarjeta de crédito");
    const cardOptions = cardSelect.locator("option");
    testInfo.skip((await cardOptions.count()) <= 1, "La cuenta E2E no tiene una tarjeta de crédito sembrada.");
    const cardOption = cardOptions.nth(1);
    const cardId = await cardOption.getAttribute("value");
    if (!cardId) throw new Error("La tarjeta sembrada no tiene un identificador seleccionable.");

    await cardSelect.selectOption(cardId);
    await authenticatedPage.getByLabel(/Comercio/).fill(merchant);
    await authenticatedPage.getByLabel(weekdayLabels[dates.weekday], { exact: true }).check();
    await authenticatedPage.getByLabel("Desde", { exact: true }).fill(dates.periodStart);
    await authenticatedPage.getByLabel("Hasta", { exact: true }).fill(dates.periodEnd);
    await authenticatedPage.getByLabel("Porcentaje de reintegro", { exact: true }).fill("20");
    await authenticatedPage.getByLabel("Tope de compras", { exact: true }).fill("600000");
    await authenticatedPage.getByLabel("Estado", { exact: true }).selectOption("active");
    await authenticatedPage.getByRole("button", { name: "Guardar beneficio" }).click();

    await expect(authenticatedPage.getByText("Beneficio guardado.", { exact: true })).toBeVisible();
    const article = authenticatedPage.getByRole("article").filter({ hasText: merchant });
    await expect(article).toBeVisible();
    await expect(article).toContainText("120.000");

    await article.getByRole("button", { name: "Duplicar período anterior" }).click();
    await authenticatedPage.getByLabel("Nueva fecha inicial").fill(dates.nextMonthStart);
    await authenticatedPage.getByLabel("Nueva fecha final").fill(dates.nextMonthEnd);
    await authenticatedPage.getByRole("button", { name: "Duplicar beneficio" }).click();
    await expect(authenticatedPage.getByText("Beneficio duplicado como borrador.", { exact: true })).toBeVisible();

    await authenticatedPage.goto("/movimientos?tipo=card_purchase");
    const movementCard = authenticatedPage.getByLabel("Tarjeta de crédito");
    await expect(movementCard).toBeVisible();
    await movementCard.selectOption(cardId);
    await authenticatedPage.getByLabel("Importe").fill("50000");
    await authenticatedPage.getByLabel("Fecha").fill(dates.occurredOn);
    await authenticatedPage.getByLabel("Comercio", { exact: true }).fill(merchant);
    const matchedStatus = authenticatedPage.getByRole("status").filter({ hasText: "Beneficio encontrado" });
    await expect(matchedStatus).toBeVisible();
    await expect(matchedStatus).toContainText("Reintegro estimado");
    await authenticatedPage.getByRole("button", { name: "Guardar operación" }).click();
    await expect(authenticatedPage.getByText("Operación guardada.", { exact: true })).toBeVisible();

    const unmatchedMerchant = `${merchant} sin coincidencia`;
    await authenticatedPage.getByLabel("Tarjeta de crédito").selectOption(cardId);
    await authenticatedPage.getByLabel("Importe").fill("25000");
    await authenticatedPage.getByLabel("Fecha").fill(dates.occurredOn);
    await authenticatedPage.getByLabel(/Comercio/).fill(unmatchedMerchant);
    await expect(authenticatedPage.getByRole("status").filter({ hasText: "No coincide" })).toBeVisible();
    await authenticatedPage.getByRole("button", { name: "Guardar operación" }).click();
    await expect(authenticatedPage.getByText("Operación guardada.", { exact: true })).toBeVisible();

    await authenticatedPage.goto("/beneficios");
    const updatedArticle = authenticatedPage.getByRole("article").filter({ hasText: merchant });
    await expect(updatedArticle).toBeVisible();
    await expect(updatedArticle.getByRole("region", { name: "Compras" })).toContainText("50.000");
    await expect(updatedArticle.getByRole("region", { name: "Compras" })).toContainText("550.000");
    await expect(updatedArticle.getByRole("region", { name: "Reintegros" })).toContainText("10.000");
    await expect(updatedArticle.getByRole("region", { name: "Reintegros" })).toContainText("110.000");
  });
});
