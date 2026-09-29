import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OperationForm } from "@/components/movements/operation-form";
import type { PersonalBenefit } from "@/lib/benefits/types";
import type { PersonalAccount } from "@/lib/finance/types";

const { recordTransaction, benefitsState } = vi.hoisted(() => ({
  recordTransaction: vi.fn(),
  benefitsState: {
    context: null as Record<string, unknown> | null,
    preview: vi.fn(),
    refresh: vi.fn(),
  },
}));
vi.mock("@/components/finance/personal-finance-provider", () => ({ usePersonalFinance: () => ({ recordTransaction }) }));
vi.mock("@/components/benefits/personal-benefits-provider", () => ({ useOptionalPersonalBenefits: () => benefitsState.context }));

const accounts: PersonalAccount[] = [
  { id: "bank-1", spaceId: "space-1", accountType: "bank", institution: "Banco", name: "Cuenta corriente", currency: "PYG", currentBalance: 1000000 },
  { id: "cash-1", spaceId: "space-1", accountType: "cash", institution: "Efectivo", name: "Billetera", currency: "PYG", currentBalance: 100000 },
  { id: "credit-1", spaceId: "space-1", accountType: "credit_card", institution: "Banco", name: "Visa", currency: "PYG", currentBalance: 0 },
];

const matchingBenefit: PersonalBenefit = {
  id: "benefit-1",
  accountId: "credit-1",
  accountLabel: "Banco · Visa",
  merchantName: "Biggie",
  merchantAliases: ["Biggie Express"],
  benefitType: "rebate",
  rateBps: 2000,
  purchaseCap: 600000,
  rebateCap: 120000,
  usedPurchase: 300000,
  usedRebate: 60000,
  currency: "PYG",
  recurrence: "monthly",
  weekdays: [2, 3, 4, 5, 6, 0, 1],
  validFrom: "2026-09-01",
  validUntil: "2026-09-30",
  channel: "all",
  conditions: null,
  sourceUrl: null,
  sourceCheckedAt: null,
  status: "active",
};

function enableBenefits(benefits: PersonalBenefit[] = [matchingBenefit]) {
  benefitsState.context = {
    benefits,
    freshness: "server",
    error: null,
    isLoading: false,
    preview: benefitsState.preview,
    refresh: benefitsState.refresh,
  };
}

afterEach(() => {
  cleanup();
  recordTransaction.mockReset();
  benefitsState.context = null;
  benefitsState.preview.mockReset();
  benefitsState.preview.mockReturnValue(null);
  benefitsState.refresh.mockReset();
  benefitsState.refresh.mockResolvedValue(undefined);
});

describe("OperationForm", () => {
  it("shows only the fields required by card payment", () => {
    render(<OperationForm accounts={accounts} initialOperationType="card_payment" />);
    expect(screen.getByLabelText("Cuenta desde la que pagás")).toBeVisible();
    expect(screen.getByLabelText("Tarjeta que pagás")).toBeVisible();
    expect(screen.queryByLabelText("Categoría")).not.toBeInTheDocument();
  });

  it("normalizes and sends a card purchase through the shared store once", async () => {
    recordTransaction.mockResolvedValue(undefined);
    render(<OperationForm accounts={accounts} initialOperationType="card_purchase" />);
    fireEvent.change(screen.getByLabelText("Tarjeta de crédito"), { target: { value: "credit-1" } });
    fireEvent.change(screen.getByLabelText("Importe"), { target: { value: "150000,25" } });
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "  Comida " } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar operación" }).closest("form")!);
    await waitFor(() => expect(recordTransaction).toHaveBeenCalledTimes(1));
    expect(recordTransaction).toHaveBeenCalledWith(expect.objectContaining({ operationType: "card_purchase", amount: 150000.25, category: "Comida" }), accounts);
    expect(screen.queryByText(/reintegro estimado/i)).not.toBeInTheDocument();
  });

  it("shows the benefit calculation automatically without an apply button", async () => {
    enableBenefits();
    benefitsState.preview.mockReturnValue({ eligiblePurchase: 85000, estimatedRebate: 17000, purchaseRemaining: 215000, rebateRemaining: 43000 });
    render(<OperationForm accounts={accounts} initialOperationType="card_purchase" />);
    fireEvent.change(screen.getByLabelText("Tarjeta de crédito"), { target: { value: "credit-1" } });
    fireEvent.change(screen.getByLabelText("Importe"), { target: { value: "85000" } });
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    fireEvent.change(screen.getByLabelText(/Comercio/), { target: { value: "Biggie" } });

    const status = await screen.findByRole("status");
    expect(status).toHaveTextContent(/beneficio encontrado/i);
    expect(status).toHaveTextContent(/Banco · Visa/i);
    expect(status).toHaveTextContent(/Biggie/i);
    expect(status).toHaveTextContent(/reintegro estimado/i);
    expect(status).toHaveTextContent(/385\.000/);
    expect(status).toHaveTextContent(/77\.000/);
    expect(status).toHaveTextContent(/215\.000/);
    expect(status).toHaveTextContent(/43\.000/);
    expect(screen.queryByRole("button", { name: /aplicar beneficio/i })).not.toBeInTheDocument();
    expect(benefitsState.preview).toHaveBeenLastCalledWith({ accountId: "credit-1", merchant: "Biggie", amount: 85000, occurredOn: "2026-09-15", currency: "PYG" });
  });

  it("shows a neutral no-match result and saves the normal purchase draft", async () => {
    enableBenefits();
    recordTransaction.mockResolvedValue(undefined);
    render(<OperationForm accounts={accounts} initialOperationType="card_purchase" />);
    fireEvent.change(screen.getByLabelText("Tarjeta de crédito"), { target: { value: "credit-1" } });
    fireEvent.change(screen.getByLabelText("Importe"), { target: { value: "85000" } });
    fireEvent.change(screen.getByLabelText("Fecha"), { target: { value: "2026-09-15" } });
    fireEvent.change(screen.getByLabelText(/Comercio/), { target: { value: "Otro comercio" } });

    expect(await screen.findByRole("status")).toHaveTextContent(/no coincide/i);
    fireEvent.submit(screen.getByRole("button", { name: "Guardar operación" }).closest("form")!);
    await waitFor(() => expect(recordTransaction).toHaveBeenCalledTimes(1));
    const [draft] = recordTransaction.mock.calls[0];
    expect(draft).toMatchObject({ operationType: "card_purchase", sourceAccountId: "credit-1", destinationAccountId: null, amount: 85000, occurredOn: "2026-09-15", merchant: "Otro comercio", items: [] });
    expect(draft).not.toHaveProperty("benefitId");
    expect(draft).not.toHaveProperty("estimatedRebate");
    expect(benefitsState.refresh).toHaveBeenCalledTimes(1);
  });

  it("keeps the financial save success when benefit refresh fails", async () => {
    enableBenefits();
    recordTransaction.mockResolvedValue(undefined);
    benefitsState.refresh.mockRejectedValue(new Error("benefits unavailable"));
    render(<OperationForm accounts={accounts} initialOperationType="card_purchase" />);
    fireEvent.change(screen.getByLabelText("Tarjeta de crédito"), { target: { value: "credit-1" } });
    fireEvent.change(screen.getByLabelText("Importe"), { target: { value: "85000" } });
    fireEvent.change(screen.getByLabelText(/Comercio/), { target: { value: "Otro comercio" } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar operación" }).closest("form")!);

    expect(await screen.findByText("Operación guardada.")).toBeInTheDocument();
    expect(screen.getByText(/beneficios.*desactualizado/i)).toBeInTheDocument();
  });

  it("keeps the draft after a store error", async () => {
    recordTransaction.mockRejectedValue(new Error("No pudimos guardar la operación."));
    render(<OperationForm accounts={accounts} initialOperationType="expense" />);
    fireEvent.change(screen.getByLabelText("Importe"), { target: { value: "50000" } });
    fireEvent.change(screen.getByLabelText("Categoría"), { target: { value: "Comida" } });
    fireEvent.submit(screen.getByRole("button", { name: "Guardar operación" }).closest("form")!);
    expect(await screen.findByText(/no pudimos guardar/i)).toBeInTheDocument();
    expect(screen.getByLabelText("Importe")).toHaveValue("50.000");
  });

  it("offers only valid account kinds and all operation modes", () => {
    render(<OperationForm accounts={accounts} />);
    expect(screen.getByLabelText("Tipo de operación")).toHaveValue("expense");
    expect(screen.getByLabelText("Cuenta de origen disponible")).toHaveValue("");
    expect(screen.queryByRole("option", { name: "Visa" })).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Tipo de operación"), { target: { value: "income" } });
    expect(screen.getByLabelText("Cuenta de destino disponible")).toBeInTheDocument();
    expect(screen.queryByLabelText("Cuenta de origen disponible")).not.toBeInTheDocument();
  });
});
