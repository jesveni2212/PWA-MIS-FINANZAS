import { authenticatedTest, expect } from "./fixtures/authenticated";

const weekdayLabels = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

function currentBenefitDates() {
  const now = new Date();
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth();
  const monthValue = String(month + 1).padStart(2, "0");
  const occurredOn = `${year}-${monthValue}-${String(now.getUTCDate()).padStart(2, "0")}`;
  return {
    occurredOn,
    periodStart: `${year}-${monthValue}-01`,
    periodEnd: new Date(Date.UTC(year, month + 1, 0)).toISOString().slice(0, 10),
    weekday: new Date(`${occurredOn}T00:00:00.000Z`).getUTCDay(),
  };
}

authenticatedTest.describe("finanzas híbridas", () => {
  authenticatedTest("muestra el dashboard desde el snapshot inicial del servidor", async ({ authenticatedPage }) => {
    let browserLedgerCalls = 0;
    authenticatedPage.on("request", (request) => {
      if (request.url().includes("/rpc/get_personal_ledger")) browserLedgerCalls += 1;
    });

    await authenticatedPage.goto("/");
    await expect(authenticatedPage.getByRole("heading", { name: "Patrimonio neto" })).toBeVisible();
    await expect(authenticatedPage.getByText("Resumen personal")).toBeVisible();
    expect(browserLedgerCalls).toBeLessThanOrEqual(1);
  });

  authenticatedTest("registra un gasto offline y lo sincroniza una sola vez", async ({ authenticatedPage }) => {
    let writeCount = 0;
    await authenticatedPage.route("**/rest/v1/rpc/record_personal_transaction", async (route) => {
      writeCount += 1;
      await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify("transaction-e2e") });
    });

    await authenticatedPage.goto("/movimientos");
    await authenticatedPage.context().setOffline(true);
    await authenticatedPage.getByLabel("Cuenta de origen disponible").selectOption({ index: 1 });
    await authenticatedPage.getByLabel("Importe").fill("1000");
    await authenticatedPage.getByLabel("Categoría").fill("Prueba offline");
    await authenticatedPage.getByRole("button", { name: "Guardar operación" }).click();
    await expect(authenticatedPage.getByText("Pendiente")).toBeVisible();

    await authenticatedPage.context().setOffline(false);
    await expect.poll(() => writeCount, { timeout: 15000 }).toBe(1);
    await authenticatedPage.reload();
    await expect(authenticatedPage.getByText("Prueba offline")).toBeVisible();
    await expect(authenticatedPage.getByText("Pendiente")).not.toBeVisible();
  });

  authenticatedTest("mantiene el preview de beneficios offline y aplica una sola vez al sincronizar", async ({ authenticatedPage }, testInfo) => {
    const dates = currentBenefitDates();
    const merchant = `E2E offline ${testInfo.project.name} ${testInfo.workerIndex} ${Date.now()}`;

    await authenticatedPage.goto("/beneficios");
    await authenticatedPage.getByRole("button", { name: "Nuevo beneficio" }).click();
    const cardSelect = authenticatedPage.getByLabel("Tarjeta de crédito");
    const cardOptions = cardSelect.locator("option");
    testInfo.skip((await cardOptions.count()) <= 1, "La cuenta E2E no tiene una tarjeta de crédito sembrada.");
    const cardId = await cardOptions.nth(1).getAttribute("value");
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

    await authenticatedPage.goto("/movimientos?tipo=card_purchase");
    await authenticatedPage.getByLabel("Tarjeta de crédito").selectOption(cardId);
    await authenticatedPage.getByLabel("Importe").fill("50000");
    await authenticatedPage.getByLabel("Fecha").fill(dates.occurredOn);
    await authenticatedPage.getByLabel("Comercio", { exact: true }).fill(merchant);
    await expect(authenticatedPage.getByRole("status").filter({ hasText: "Beneficio encontrado" })).toBeVisible();

    let writeCount = 0;
    await authenticatedPage.route("**/rest/v1/rpc/record_personal_transaction", async (route) => {
      writeCount += 1;
      if (writeCount === 1) {
        await route.fetch();
        await route.abort("failed");
        return;
      }
      await route.continue();
    });

    await authenticatedPage.context().setOffline(true);
    await expect(authenticatedPage.getByRole("note")).toContainText("Cálculo con datos guardados");
    await authenticatedPage.getByRole("button", { name: "Guardar operación" }).click();
    await expect(authenticatedPage.getByText("Pendiente")).toBeVisible();
    expect(writeCount).toBe(0);

    await authenticatedPage.context().setOffline(false);
    await expect.poll(() => writeCount, { timeout: 15000 }).toBe(1);
    await authenticatedPage.context().setOffline(true);
    await authenticatedPage.context().setOffline(false);
    await expect.poll(() => writeCount, { timeout: 15000 }).toBe(2);
    await expect(authenticatedPage.getByText("Pendiente")).not.toBeVisible();

    await authenticatedPage.goto("/beneficios");
    const updatedArticle = authenticatedPage.getByRole("article").filter({ hasText: merchant });
    await expect(updatedArticle).toBeVisible();
    const purchases = updatedArticle.getByRole("region", { name: "Compras" });
    const rebates = updatedArticle.getByRole("region", { name: "Reintegros" });
    await expect(purchases).toContainText("50.000");
    await expect(purchases).toContainText("550.000");
    await expect(purchases).not.toContainText("100.000");
    await expect(rebates).toContainText("10.000");
    await expect(rebates).toContainText("110.000");
    await expect(rebates).not.toContainText("20.000");
  });
});
