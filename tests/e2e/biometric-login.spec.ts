import { expect, test, type Page } from "@playwright/test";

const email = process.env.E2E_TEST_EMAIL;
const password = process.env.E2E_TEST_PASSWORD;
const offerTitle = "¿Activar huella o Face ID?";
const lockName = "Aplicación bloqueada";

async function signIn(page: Page, { remember }: { remember: boolean }, testInfo: { skip: (condition: boolean, reason: string) => void }) {
  await page.goto("/acceso");
  await page.getByLabel("Correo electrónico").fill(email!);
  await page.getByLabel("Contraseña").fill(password!);
  if (remember) await page.getByLabel("Recordar mi correo").check();
  await page.getByRole("button", { name: "Iniciar sesión" }).click();
  const notice = page.getByText("La autenticación estará disponible cuando se configure el servicio.");
  const offer = page.getByText(offerTitle);
  await expect(notice.or(offer).or(page.locator("main"))).toBeVisible();
  if (await notice.isVisible().catch(() => false)) {
    testInfo.skip(true, "La instancia de Supabase no está configurada para los flujos autenticados.");
  }
}

test.describe("recordar correo y desbloqueo biométrico", () => {
  test.skip(!email || !password, "Definí E2E_TEST_EMAIL y E2E_TEST_PASSWORD para ejecutar los flujos autenticados.");

  test("precarga el correo recordado después de cerrar sesión", async ({ page }, testInfo) => {
    await signIn(page, { remember: true }, testInfo);
    const offer = page.getByText(offerTitle);
    if (await offer.isVisible().catch(() => false)) await page.getByRole("button", { name: "Ahora no" }).click();
    await expect(page).toHaveURL(/\/$/);

    await page.goto("/perfil");
    await page.getByRole("button", { name: "Cerrar sesión" }).click();
    await expect(page).toHaveURL(/\/acceso$/);

    await expect(page.getByLabel("Correo electrónico")).toHaveValue(email!);
    await expect(page.getByLabel("Recordar mi correo")).toBeChecked();
  });

  test("desbloquea con un autenticador virtual y mantiene el bloqueo si la verificación falla", async ({ page, browserName }, testInfo) => {
    test.skip(browserName !== "chromium", "El autenticador virtual de WebAuthn solo existe en Chromium.");

    const cdp = await page.context().newCDPSession(page);
    await cdp.send("WebAuthn.enable");
    const { authenticatorId } = await cdp.send("WebAuthn.addVirtualAuthenticator", {
      options: {
        protocol: "ctap2",
        transport: "internal",
        hasResidentKey: false,
        hasUserVerification: true,
        isUserVerified: true,
        automaticPresenceSimulation: true,
      },
    });

    await signIn(page, { remember: false }, testInfo);
    await expect(page.getByText(offerTitle)).toBeVisible();
    await page.getByRole("button", { name: "Activar" }).click();
    await expect(page).toHaveURL(/\/$/);

    // A cold start: the unlocked mark lives in sessionStorage.
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole("dialog", { name: lockName })).toBeHidden();

    await cdp.send("WebAuthn.setUserVerified", { authenticatorId, isUserVerified: false });
    await page.evaluate(() => window.sessionStorage.clear());
    await page.reload();
    await expect(page.getByRole("dialog", { name: lockName })).toBeVisible();

    await page.getByRole("button", { name: "Usar contraseña" }).click();
    await expect(page).toHaveURL(/\/acceso$/);
  });
});
