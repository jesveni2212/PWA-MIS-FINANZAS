import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { MovementsContent } from "@/components/movements/movements-content";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import type { PersonalAccount, PersonalTransaction } from "@/lib/finance/types";

vi.mock("@/lib/finance/personal-ledger", async () => { const actual = await vi.importActual<typeof import("@/lib/finance/personal-ledger")>("@/lib/finance/personal-ledger"); return { ...actual, loadPersonalLedger: vi.fn() }; });
const accounts: PersonalAccount[] = [
  { id: "ueno", spaceId: "personal", accountType: "bank", institution: "Ueno", name: "Cuenta", currency: "PYG", currentBalance: 100000 },
  { id: "gnb", spaceId: "personal", accountType: "credit_card", institution: "GNB", name: "Visa", currency: "PYG", currentBalance: 0 },
];
const payment: PersonalTransaction = { id: "payment-1", operationType: "card_payment", sourceAccountId: "ueno", destinationAccountId: "gnb", amount: 25000, currency: "PYG", occurredOn: "2026-09-03", category: null, merchant: null, note: null, items: [] };
afterEach(() => { cleanup(); vi.mocked(loadPersonalLedger).mockReset(); });

describe("MovementsContent", () => {
  it("loads only the personal ledger and renders an explicit card payment", async () => {
    vi.mocked(loadPersonalLedger).mockResolvedValue({ accounts, transactions: [{ ...payment, items: [] }] });
    render(<MovementsContent />);
    expect(await screen.findByText(/Pago de GNB desde Ueno/i)).toBeInTheDocument();
    expect(screen.queryByText("Casa compartida")).not.toBeInTheDocument();
    expect(loadPersonalLedger).toHaveBeenCalledTimes(1);
  });

  it("preserves loading, empty, error and retry states", async () => {
    let resolve: (value: { accounts: PersonalAccount[]; transactions: PersonalTransaction[] }) => void = () => undefined;
    vi.mocked(loadPersonalLedger).mockReturnValue(new Promise((done) => { resolve = done; }));
    render(<MovementsContent />);
    expect(screen.getByText(/Cargando movimientos personales/i)).toBeInTheDocument();
    resolve({ accounts, transactions: [] });
    expect(await screen.findByText(/Todavía no registraste/i)).toBeInTheDocument();
    cleanup();
    vi.mocked(loadPersonalLedger).mockRejectedValueOnce(new Error("boom"));
    render(<MovementsContent />);
    expect(await screen.findByRole("button", { name: "Reintentar" })).toBeInTheDocument();
    vi.mocked(loadPersonalLedger).mockResolvedValueOnce({ accounts, transactions: [] });
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText(/Todavía no registraste/i)).toBeInTheDocument());
  });

  it("renders transaction detail items and a valid initial operation type", async () => {
    vi.mocked(loadPersonalLedger).mockResolvedValue({ accounts, transactions: [{ ...payment, operationType: "card_purchase", sourceAccountId: "gnb", merchant: "Mercado", note: "Detalle", category: "Comida", items: [{ id: "item-1", description: "Pan", quantity: 2, unitPrice: 3000 }] }] });
    render(<MovementsContent initialOperationType="transfer" />);
    expect(await screen.findByText("Compra con GNB")).toBeInTheDocument();
    expect(screen.getByLabelText("Tipo de operación")).toHaveValue("transfer");
    fireEvent.click(screen.getByText("Compra con GNB"));
    expect(screen.getByText("Pan × 2")).toBeInTheDocument();
    expect(screen.getByText("Mercado")).toBeInTheDocument();
  });
});
