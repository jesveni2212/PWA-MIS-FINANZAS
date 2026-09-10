import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { MovementsContent } from "@/components/movements/movements-content";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import type { PersonalAccount, PersonalLedger, PersonalTransaction } from "@/lib/finance/types";

vi.mock("@/lib/finance/personal-ledger", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/finance/personal-ledger")>(),
  loadPersonalLedger: vi.fn(),
}));

const mockedLoadPersonalLedger = vi.mocked(loadPersonalLedger);
const accounts: PersonalAccount[] = [
  { id: "ueno", spaceId: "personal", accountType: "bank", institution: "Ueno", name: "Cuenta", currency: "PYG", currentBalance: 100000 },
  { id: "gnb", spaceId: "personal", accountType: "credit_card", institution: "GNB", name: "Visa", currency: "PYG", currentBalance: 0 },
];
const payment: PersonalTransaction = { id: "payment-1", operationType: "card_payment", sourceAccountId: "ueno", destinationAccountId: "gnb", amount: 25000, currency: "PYG", occurredOn: "2026-09-03", category: null, merchant: null, note: null, items: [] };

function renderMovements(ledger: PersonalLedger, initialOperationType?: "income" | "expense" | "card_purchase" | "transfer" | "card_payment") {
  return render(
    <PersonalFinanceProvider initialLedger={ledger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="movements-test">
      <MovementsContent initialOperationType={initialOperationType} />
    </PersonalFinanceProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  mockedLoadPersonalLedger.mockReset();
});

afterEach(() => cleanup());

describe("MovementsContent", () => {
  it("renders the provider ledger without a second browser ledger load", () => {
    renderMovements({ accounts, transactions: [{ ...payment, items: [] }] });
    expect(screen.getByText(/Pago de GNB desde Ueno/i)).toBeInTheDocument();
    expect(screen.queryByText("Casa compartida")).not.toBeInTheDocument();
    expect(mockedLoadPersonalLedger).not.toHaveBeenCalled();
  });

  it("renders the initial empty state immediately", () => {
    renderMovements({ accounts, transactions: [] });
    expect(screen.getByText(/Todavía no registraste/)).toBeInTheDocument();
    expect(screen.queryByText(/Cargando movimientos personales/)).not.toBeInTheDocument();
  });

  it("renders transaction detail items and a valid initial operation type", () => {
    renderMovements({ accounts, transactions: [{ ...payment, operationType: "card_purchase", sourceAccountId: "gnb", merchant: "Mercado", note: "Detalle", category: "Comida", items: [{ id: "item-1", description: "Pan", quantity: 2, unitPrice: 3000 }] }] }, "transfer");
    expect(screen.getByText("Compra con GNB")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de operación")).toHaveValue("transfer");
    fireEvent.click(screen.getByText("Compra con GNB"));
    expect(screen.getByText("Pan × 2")).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
  });

  it("marks a pending local transaction", () => {
    renderMovements({ accounts, transactions: [{ ...payment, id: "pending:op-1", syncStatus: "pending" }] });
    expect(screen.getByText("Pendiente")).toBeInTheDocument();
  });
});
