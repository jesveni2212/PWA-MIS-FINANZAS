import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { OperationForm } from "@/components/movements/operation-form";
import type { PersonalAccount } from "@/lib/finance/types";

const { recordTransaction } = vi.hoisted(() => ({ recordTransaction: vi.fn() }));
vi.mock("@/components/finance/personal-finance-provider", () => ({ usePersonalFinance: () => ({ recordTransaction }) }));

const accounts: PersonalAccount[] = [
  { id: "bank-1", spaceId: "space-1", accountType: "bank", institution: "Banco", name: "Cuenta corriente", currency: "PYG", currentBalance: 1000000 },
  { id: "cash-1", spaceId: "space-1", accountType: "cash", institution: "Efectivo", name: "Billetera", currency: "PYG", currentBalance: 100000 },
  { id: "credit-1", spaceId: "space-1", accountType: "credit_card", institution: "Banco", name: "Visa", currency: "PYG", currentBalance: 0 },
];

afterEach(() => { cleanup(); recordTransaction.mockReset(); });

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
