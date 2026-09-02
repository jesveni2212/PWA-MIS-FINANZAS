import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";

vi.mock("@/lib/finance/personal-ledger", () => ({ loadPersonalLedger: vi.fn() }));

const mockedLoadPersonalLedger = vi.mocked(loadPersonalLedger);

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("mis-finanzas:balances-hidden");
  mockedLoadPersonalLedger.mockReset();
});

describe("PersonalDashboard", () => {
  it("shows net worth and the credit cards that are due", async () => {
    mockedLoadPersonalLedger.mockResolvedValue({
      accounts: [
        { id: "available-1", spaceId: "personal-1", accountType: "bank", institution: "Ueno", name: "Cuenta", currency: "PYG", currentBalance: 450000 },
        { id: "credit-1", spaceId: "personal-1", accountType: "credit_card", institution: "Ueno", name: "Visa", currency: "PYG", currentBalance: 0 },
      ],
      transactions: [],
    });

    render(<PersonalDashboard />);

    expect(await screen.findByText("Patrimonio neto")).toBeInTheDocument();
    expect(screen.getByText("Tarjetas por pagar")).toBeInTheDocument();
    expect(screen.getByText("Ueno · Crédito")).toBeInTheDocument();
    expect(screen.getByText("Al día")).toBeInTheDocument();
  });

  it("keeps labels visible while the personal data is loading", () => {
    mockedLoadPersonalLedger.mockReturnValue(new Promise(() => undefined));

    render(<PersonalDashboard />);

    expect(screen.getByText("Cargando resumen personal…")).toBeInTheDocument();
  });

  it("explains when the personal ledger has no accounts", async () => {
    mockedLoadPersonalLedger.mockResolvedValue({ accounts: [], transactions: [] });

    render(<PersonalDashboard />);

    expect(await screen.findByText("Todavía no tenés cuentas personales para resumir.")).toBeInTheDocument();
  });

  it("retries after an understandable load error", async () => {
    mockedLoadPersonalLedger
      .mockRejectedValueOnce(new Error("internal detail"))
      .mockResolvedValueOnce({ accounts: [], transactions: [] });

    render(<PersonalDashboard />);

    expect(await screen.findByText("No pudimos cargar tus finanzas personales. Volvé a intentar.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText("Todavía no tenés cuentas personales para resumir.")).toBeInTheDocument());
    expect(screen.queryByText("internal detail")).not.toBeInTheDocument();
  });
});
