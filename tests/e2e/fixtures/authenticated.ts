import { expect, test as base, type Page } from "@playwright/test";

type AuthenticatedFixtures = { authenticatedPage: Page };
const hasE2ECredentials = Boolean(process.env.E2E_TEST_EMAIL && process.env.E2E_TEST_PASSWORD);

export const authenticatedTest = base.extend<AuthenticatedFixtures>({
  authenticatedPage: async ({ page }, providePage, testInfo) => {
    const email = process.env.E2E_TEST_EMAIL;
    const password = process.env.E2E_TEST_PASSWORD;
    if (!email || !password) {
      await providePage(page);
      return;
    }

    await page.goto("/acceso");
    await page.getByLabel("Correo electrónico").fill(email);
    await page.getByLabel("Contraseña").fill(password);
    await page.getByRole("button", { name: "Iniciar sesión" }).click();
    if (await page.getByText("La autenticación estará disponible cuando se configure el servicio.").isVisible().catch(() => false)) {
      testInfo.skip(true, "La instancia de Supabase no está configurada para los flujos autenticados.");
    }
    await expect(page).toHaveURL(/\/$/);
    await providePage(page);
  },
});

authenticatedTest.skip(!hasE2ECredentials, "Definí E2E_TEST_EMAIL y E2E_TEST_PASSWORD para ejecutar los flujos autenticados.");

export { expect } from "@playwright/test";
