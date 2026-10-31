import type { Locator, Page } from "@playwright/test";

// Below the desktop breakpoint the sections live in the hamburger menu; on desktop they are in the sidebar.
export async function openMainNavigation(page: Page): Promise<Locator> {
  const menuButton = page.getByRole("button", { name: "Abrir menú" });
  if (await menuButton.isVisible()) {
    await menuButton.click();
    return page.getByRole("dialog", { name: "Menú" }).getByRole("navigation", { name: "Menú móvil" });
  }
  return page.getByRole("navigation", { name: "Navegación principal" });
}
