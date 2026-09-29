import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { BenefitForm } from "@/components/benefits/benefit-form";
import type { PersonalBenefit } from "@/lib/benefits/types";
import type { PersonalAccount } from "@/lib/finance/types";

const { finance, benefits } = vi.hoisted(() => ({
  finance: { ledger: { accounts: [] as PersonalAccount[], transactions: [] }, freshness: "server", lastUpdatedAt: "2026-09-01" as string | null, isSyncing: false, refresh: vi.fn() },
  benefits: { createBenefit: vi.fn(), updateBenefit: vi.fn() },
}));
vi.mock("@/components/finance/personal-finance-provider", () => ({ usePersonalFinance: () => finance }));
vi.mock("@/components/benefits/personal-benefits-provider", () => ({ usePersonalBenefits: () => benefits }));

const card: PersonalAccount = { id: "card-1", spaceId: "personal", accountType: "credit_card", institution: "Entidad de prueba", name: "Tarjeta uno", currency: "PYG", currentBalance: 0 };
const savedBenefit: PersonalBenefit = { id: "benefit-1", accountId: card.id, accountLabel: "Entidad de prueba · Tarjeta uno", merchantName: "Comercio de prueba", merchantAliases: ["Sucursal"], benefitType: "rebate", rateBps: 2000, purchaseCap: 600000, rebateCap: 120000, usedPurchase: 0, usedRebate: 0, currency: "PYG", recurrence: "monthly", weekdays: [2], validFrom: "2026-09-01", validUntil: "2026-09-30", channel: "all", conditions: null, sourceUrl: null, sourceCheckedAt: null, status: "draft" };

function fillDraft() {
  fireEvent.change(screen.getByLabelText("Tarjeta de crédito"), { target: { value: card.id } });
  fireEvent.change(screen.getByLabelText("Comercio"), { target: { value: "  Comercio de prueba  " } });
  fireEvent.change(screen.getByLabelText(/Alias/), { target: { value: " Sucursal, Otra sucursal " } });
  fireEvent.click(screen.getByLabelText("Martes"));
  fireEvent.change(screen.getByLabelText("Porcentaje de reintegro"), { target: { value: "20" } });
  fireEvent.change(screen.getByLabelText("Tope de compras"), { target: { value: "600000" } });
  fireEvent.change(screen.getByLabelText(/URL de la fuente/), { target: { value: "https://fuente.example/promo" } });
}

beforeEach(() => {
  vi.clearAllMocks();
  finance.ledger.accounts = [card, { ...card, id: "card-2", name: "Tarjeta dos", currency: "USD" }, { ...card, id: "bank", accountType: "bank", name: "Cuenta bancaria" }];
  finance.freshness = "server"; finance.lastUpdatedAt = "2026-09-01"; finance.isSyncing = false;
  finance.refresh.mockResolvedValue(undefined);
  benefits.createBenefit.mockResolvedValue(undefined); benefits.updateBenefit.mockResolvedValue(undefined);
});
afterEach(cleanup);

describe("BenefitForm", () => {
  it("offers only credit cards, derives the cap and submits the controlled draft", async () => {
    const onSaved = vi.fn();
    render(<BenefitForm periodStart="2026-09-01" onSaved={onSaved} />);
    const selector = screen.getByLabelText("Tarjeta de crédito");
    expect(within(selector).getAllByRole("option")).toHaveLength(3);
    expect(within(selector).queryByText(/Cuenta bancaria/)).not.toBeInTheDocument();
    fillDraft();
    expect(screen.getByLabelText("Tope de reintegro calculado")).toHaveTextContent(/120\.000/);
    expect(screen.queryByRole("textbox", { name: /Tope de reintegro/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Guardar beneficio" }));
    await waitFor(() => expect(benefits.createBenefit).toHaveBeenCalledWith(expect.objectContaining({ accountId: card.id, merchantName: "Comercio de prueba", merchantAliases: ["Sucursal", "Otra sucursal"], rateBps: 2000, purchaseCap: 600000, rebateCap: 120000, weekdays: [2], recurrence: "monthly", validFrom: "2026-09-01", validUntil: "2026-09-30", currency: "PYG", sourceUrl: "https://fuente.example/promo", status: "draft" })));
    expect(onSaved).toHaveBeenCalledOnce();
  });

  it("links to accounts and disables submission when no credit cards exist", () => {
    finance.ledger.accounts = [];
    render(<BenefitForm periodStart="2026-09-01" />);
    expect(screen.getByRole("link", { name: /Registrar tarjeta/ })).toHaveAttribute("href", "/cuentas");
    expect(screen.getByRole("button", { name: "Guardar beneficio" })).toBeDisabled();
  });

  it("distinguishes an unavailable ledger from an empty card list and retries", async () => {
    finance.ledger.accounts = []; finance.freshness = "offline"; finance.lastUpdatedAt = null;
    render(<BenefitForm periodStart="2026-09-01" />);
    expect(screen.getByRole("alert")).toHaveTextContent(/No pudimos cargar tus tarjetas/);
    expect(screen.queryByRole("link", { name: /Registrar tarjeta/ })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar tarjetas" }));
    await waitFor(() => expect(finance.refresh).toHaveBeenCalledOnce());
    expect(screen.getByRole("button", { name: "Guardar beneficio" })).toBeDisabled();
  });

  it("shows card loading without claiming there are no cards", () => {
    finance.ledger.accounts = []; finance.isSyncing = true;
    render(<BenefitForm periodStart="2026-09-01" />);
    expect(screen.getByText(/Cargando tarjetas/)).toHaveAttribute("role", "status");
    expect(screen.queryByRole("link", { name: /Registrar tarjeta/ })).not.toBeInTheDocument();
  });

  it("preserves input after server validation fails", async () => {
    benefits.createBenefit.mockRejectedValue(new Error("Revisá la vigencia del beneficio."));
    render(<BenefitForm periodStart="2026-09-01" />);
    fillDraft();
    fireEvent.click(screen.getByRole("button", { name: "Guardar beneficio" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Revisá la vigencia del beneficio.");
    expect(screen.getByLabelText("Comercio")).toHaveValue("  Comercio de prueba  ");
    expect(screen.getByLabelText("Tope de compras")).toHaveValue("600.000");
  });

  it("updates an existing monthly benefit", async () => {
    render(<BenefitForm initialValue={savedBenefit} periodStart="2026-09-01" />);
    fireEvent.change(screen.getByLabelText("Estado"), { target: { value: "active" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar beneficio" }));
    await waitFor(() => expect(benefits.updateBenefit).toHaveBeenCalledWith(savedBenefit.id, expect.objectContaining({ status: "active", recurrence: "monthly" })));
    expect(benefits.createBenefit).not.toHaveBeenCalled();
  });

  it("uses the selected card currency and validates a currency mismatch", async () => {
    render(<BenefitForm periodStart="2026-09-01" />);
    fillDraft();
    fireEvent.change(screen.getByLabelText("Tarjeta de crédito"), { target: { value: "card-2" } });
    expect(screen.getByLabelText("Moneda")).toHaveValue("USD");
    fireEvent.change(screen.getByLabelText("Moneda"), { target: { value: "PYG" } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar beneficio" }));
    expect(screen.getByRole("alert")).toHaveTextContent(/moneda.*coincidir/);
    expect(benefits.createBenefit).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Moneda"), { target: { value: "USD" } });
    fireEvent.change(screen.getByLabelText("Canal"), { target: { value: "web" } });
    fireEvent.change(screen.getByLabelText("Condiciones"), { target: { value: "  Compra en línea.  " } });
    fireEvent.click(screen.getByRole("button", { name: "Guardar beneficio" }));
    await waitFor(() => expect(benefits.createBenefit).toHaveBeenCalledWith(expect.objectContaining({ accountId: "card-2", currency: "USD", channel: "web", conditions: "Compra en línea." })));
  });

  it("does not silently convert or save weekly rules", () => {
    render(<BenefitForm initialValue={{ ...savedBenefit, recurrence: "weekly" }} periodStart="2026-09-01" />);
    expect(screen.getByLabelText("Recurrencia")).toHaveValue("weekly");
    expect(screen.getByText(/semanales.*consultar/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Guardar beneficio" })).toBeDisabled();
    fireEvent.submit(screen.getByRole("button", { name: "Guardar beneficio" }).closest("form")!);
    expect(benefits.updateBenefit).not.toHaveBeenCalled();
  });

  it("rejects invalid dates, weekdays, caps and unsafe source URLs before saving", () => {
    render(<BenefitForm initialValue={savedBenefit} periodStart="2026-09-01" />);
    const form = screen.getByRole("button", { name: "Guardar beneficio" }).closest("form")!;
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-08-01" } });
    fireEvent.submit(form);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Hasta"), { target: { value: "2026-09-30" } });
    fireEvent.click(screen.getByLabelText("Martes")); fireEvent.submit(form);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText("Martes"));
    fireEvent.change(screen.getByLabelText("Tope de compras"), { target: { value: "0" } }); fireEvent.submit(form);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tope de compras"), { target: { value: "600000" } });
    fireEvent.change(screen.getByLabelText(/URL de la fuente/), { target: { value: "javascript:alert(1)" } }); fireEvent.submit(form);
    expect(screen.getByRole("alert")).toBeInTheDocument();
    expect(benefits.updateBenefit).not.toHaveBeenCalled();
  });
});
