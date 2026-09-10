import { authenticatedTest, expect } from "./fixtures/authenticated";

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
});
