import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitsContent } from "@/components/benefits/benefits-content";
import type { PersonalBenefit } from "@/lib/benefits/types";
import type { PersonalAccount } from "@/lib/finance/types";

const { push, finance, store } = vi.hoisted(() => ({
  push: vi.fn(),
  finance: { ledger: { accounts: [] as PersonalAccount[], transactions: [] }, freshness: "server", lastUpdatedAt: "2026-09-01" as string | null, isSyncing: false, refresh: vi.fn() },
  store: { benefits: [] as PersonalBenefit[], freshness: "server", error: null as string | null, isLoading: false, refresh: vi.fn(), createBenefit: vi.fn(), updateBenefit: vi.fn(), disableBenefit: vi.fn(), duplicateBenefit: vi.fn() },
}));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
vi.mock("@/components/app-shell", () => ({ useBalancesHidden: () => false }));
vi.mock("@/components/finance/personal-finance-provider", () => ({ usePersonalFinance: () => finance }));
vi.mock("@/components/benefits/personal-benefits-provider", () => ({ usePersonalBenefits: () => store }));

const card: PersonalAccount = { id: "card-1", spaceId: "personal", accountType: "credit_card", institution: "Entidad de prueba", name: "Tarjeta uno", currency: "PYG", currentBalance: 0 };
const benefit: PersonalBenefit = { id: "benefit-1", accountId: card.id, accountLabel: "Entidad de prueba · Tarjeta uno", merchantName: "Comercio de prueba", merchantAliases: [], benefitType: "rebate", rateBps: 2000, purchaseCap: 600000, rebateCap: 120000, usedPurchase: 300000, usedRebate: 30000, currency: "PYG", recurrence: "monthly", weekdays: [2], validFrom: "2026-09-01", validUntil: "2026-09-30", channel: "physical", conditions: "Presentar la tarjeta.", sourceUrl: "https://fuente.example/promo", sourceCheckedAt: null, status: "active" };

beforeEach(() => {
  vi.clearAllMocks();
  finance.ledger.accounts = [card]; finance.freshness = "server"; finance.lastUpdatedAt = "2026-09-01"; finance.isSyncing = false;
  store.benefits = [benefit]; store.freshness = "server"; store.error = null; store.isLoading = false;
  for (const action of [finance.refresh, store.refresh, store.createBenefit, store.updateBenefit, store.duplicateBenefit, store.disableBenefit]) action.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe("BenefitsContent", () => {
  it("groups by card, shows dates, conditions, status and an ordinary source link without fetching", () => {
    const fetch = vi.fn(); vi.stubGlobal("fetch", fetch);
    store.benefits = [benefit, { ...benefit, id: "benefit-2", merchantName: "Segundo comercio" }, { ...benefit, id: "benefit-3", accountId: "card-2", accountLabel: "Otra tarjeta", merchantName: "Tercer comercio" }];
    render(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByRole("heading", { level: 2, name: benefit.accountLabel })).toBeInTheDocument();
    expect(screen.getByRole("heading", { level: 2, name: "Otra tarjeta" })).toBeInTheDocument();
    const article = screen.getByRole("article", { name: `${benefit.merchantName} · ${benefit.accountLabel}` });
    expect(within(article).getByText("Presentar la tarjeta.")).toBeInTheDocument();
    expect(within(article).getByText("Activo")).toBeInTheDocument();
    expect(article.querySelector('time[datetime="2026-09-30"]')).not.toBeNull();
    const source = within(article).getByRole("link", { name: "Ver fuente de la promoción" });
    expect(source).toHaveAttribute("href", benefit.sourceUrl);
    expect(source).toHaveAttribute("rel", "noopener noreferrer");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("shows separate purchase/rebate used and remaining amounts with independent widths", () => {
    render(<BenefitsContent periodStart="2026-09-01" />);
    const purchases = screen.getByRole("region", { name: "Compras" });
    const rebates = screen.getByRole("region", { name: "Reintegros" });
    expect(purchases).toHaveTextContent(/Usado.*300\.000.*Disponible.*300\.000.*Tope.*600\.000/);
    expect(rebates).toHaveTextContent(/Usado.*30\.000.*Disponible.*90\.000.*Tope.*120\.000/);
    expect(within(purchases).getByRole("progressbar").firstElementChild).toHaveStyle({ width: "50%" });
    expect(within(rebates).getByRole("progressbar").firstElementChild).toHaveStyle({ width: "25%" });
  });

  it("clamps only visual progress and keeps exact over-cap consumption visible", () => {
    store.benefits = [{ ...benefit, usedPurchase: 650000, usedRebate: 130000 }];
    render(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByRole("region", { name: "Compras" })).toHaveTextContent(/650\.000/);
    for (const progress of screen.getAllByRole("progressbar")) expect(progress.firstElementChild).toHaveStyle({ width: "100%" });
  });

  it("distinguishes no cards, ledger errors and benefit errors from an empty period", () => {
    store.benefits = []; finance.ledger.accounts = [];
    const view = render(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByRole("link", { name: "Registrar tarjeta" })).toHaveAttribute("href", "/cuentas");
    finance.freshness = "offline"; finance.lastUpdatedAt = null;
    view.rerender(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByRole("alert")).toHaveTextContent("No pudimos cargar tus tarjetas");
    expect(screen.queryByRole("link", { name: "Registrar tarjeta" })).not.toBeInTheDocument();
    finance.ledger.accounts = [card]; finance.freshness = "server"; finance.lastUpdatedAt = "2026-09-01";
    store.error = "No pudimos cargar tus beneficios personales. Volvé a intentar.";
    view.rerender(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByRole("alert")).toHaveTextContent(store.error);
    expect(screen.queryByText(/Todavía no tenés beneficios/)).not.toBeInTheDocument();
    store.error = null;
    view.rerender(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByText(/Todavía no tenés beneficios/)).toBeInTheDocument();
  });

  it("shows loading and cached/offline states without a false empty-period message", () => {
    store.benefits = []; store.isLoading = true;
    const view = render(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByRole("status")).toHaveTextContent("Cargando beneficios");
    expect(screen.queryByText(/Todavía no tenés beneficios/)).not.toBeInTheDocument();
    store.isLoading = false; store.freshness = "cached";
    view.rerender(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByRole("status")).toHaveTextContent("Mostrando beneficios guardados");
    store.freshness = "offline";
    view.rerender(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByRole("status")).toHaveTextContent("Sin datos actualizados");
    expect(screen.queryByText(/Todavía no tenés beneficios/)).not.toBeInTheDocument();
  });

  it("loads the selected month through route navigation", () => {
    render(<BenefitsContent periodStart="2026-09-01" />);
    fireEvent.change(screen.getByLabelText("Período"), { target: { value: "2026-08" } });
    expect(push).toHaveBeenCalledWith("/beneficios?periodo=2026-08");
  });

  it("opens and saves the manual form through the provider", async () => {
    render(<BenefitsContent periodStart="2026-09-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Nuevo beneficio" }));
    fireEvent.change(screen.getByLabelText("Tarjeta de crédito"), { target: { value: card.id } });
    fireEvent.change(screen.getByLabelText("Comercio"), { target: { value: "Nuevo comercio" } });
    fireEvent.click(screen.getByLabelText("Martes"));
    fireEvent.change(screen.getByLabelText("Porcentaje de reintegro"), { target: { value: "20" } });
    fireEvent.change(screen.getByLabelText("Tope de compras"), { target: { value: "600000" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar beneficio" }));
    await waitFor(() => expect(store.createBenefit).toHaveBeenCalledOnce());
    expect(screen.queryByRole("form", { name: "Nuevo beneficio" })).not.toBeInTheDocument();
  });

  it("edits and disables benefits using the provider callbacks", async () => {
    render(<BenefitsContent periodStart="2026-09-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Editar" }));
    fireEvent.change(screen.getByLabelText("Comercio"), { target: { value: "Comercio actualizado" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar beneficio" }));
    await waitFor(() => expect(store.updateBenefit).toHaveBeenCalledWith(benefit.id, expect.objectContaining({ merchantName: "Comercio actualizado" })));
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    await waitFor(() => expect(store.disableBenefit).toHaveBeenCalledWith(benefit.id));
  });

  it("duplicates only after user-selected dates and retains them on validation failure", async () => {
    store.duplicateBenefit.mockRejectedValueOnce(new Error("Vigencia rechazada."));
    render(<BenefitsContent periodStart="2026-09-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar período anterior" }));
    expect(screen.getByLabelText("Nueva fecha inicial")).toHaveValue("");
    expect(store.duplicateBenefit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Nueva fecha inicial"), { target: { value: "2026-10-01" } });
    fireEvent.change(screen.getByLabelText("Nueva fecha final"), { target: { value: "2026-10-31" } });
    fireEvent.click(screen.getByRole("button", { name: "Duplicar beneficio" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Vigencia rechazada.");
    expect(screen.getByLabelText("Nueva fecha inicial")).toHaveValue("2026-10-01");
    expect(store.duplicateBenefit).toHaveBeenCalledWith(benefit.id, "2026-10-01", "2026-10-31");
    fireEvent.click(screen.getByRole("button", { name: "Duplicar beneficio" }));
    await waitFor(() => expect(screen.queryByRole("form", { name: "Duplicar beneficio" })).not.toBeInTheDocument());
    expect(screen.getByText("Beneficio duplicado como borrador.")).toHaveAttribute("role", "status");
    expect(screen.getByRole("link", { name: "Ver período guardado" })).toHaveAttribute("href", "/beneficios?periodo=2026-10");
  });

  it("rejects reversed duplicate dates before invoking the provider", () => {
    render(<BenefitsContent periodStart="2026-09-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Duplicar período anterior" }));
    fireEvent.change(screen.getByLabelText("Nueva fecha inicial"), { target: { value: "2026-10-31" } });
    fireEvent.change(screen.getByLabelText("Nueva fecha final"), { target: { value: "2026-10-01" } });
    fireEvent.submit(screen.getByRole("form", { name: "Duplicar beneficio" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/Elegí una vigencia válida/);
    expect(store.duplicateBenefit).not.toHaveBeenCalled();
  });

  it("keeps weekly rules visible but disables edit and duplicate", () => {
    store.benefits = [{ ...benefit, recurrence: "weekly" }];
    render(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.getByText(/Semanal/)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Editar" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Duplicar período anterior" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Desactivar" })).toBeEnabled();
  });

  it("retries benefit/card errors and reports rejected disable actions", async () => {
    store.error = "Error de beneficios.";
    render(<BenefitsContent periodStart="2026-09-01" />);
    fireEvent.click(screen.getByRole("button", { name: "Reintentar beneficios" }));
    await waitFor(() => expect(store.refresh).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.getByRole("button", { name: "Desactivar" })).toBeEnabled());
    store.disableBenefit.mockRejectedValue(new Error("No pudimos desactivar el beneficio."));
    fireEvent.click(screen.getByRole("button", { name: "Desactivar" }));
    expect(await screen.findByText("No pudimos desactivar el beneficio.")).toHaveAttribute("role", "alert");
  });

  it("never renders unsafe source URL schemes as links", () => {
    store.benefits = [{ ...benefit, sourceUrl: "javascript:alert(1)" }];
    render(<BenefitsContent periodStart="2026-09-01" />);
    expect(screen.queryByRole("link", { name: "Ver fuente de la promoción" })).not.toBeInTheDocument();
  });
});
