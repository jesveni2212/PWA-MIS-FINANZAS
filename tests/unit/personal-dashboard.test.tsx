import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
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
  it("keeps PYG and USD balances separate while showing cards due", async () => {
    mockedLoadPersonalLedger.mockResolvedValue({
      accounts: [
        { id: "available-pyg", spaceId: "personal-1", accountType: "bank", institution: "Ueno", name: "Cuenta", currency: "PYG", currentBalance: 450000 },
        { id: "credit-pyg", spaceId: "personal-1", accountType: "credit_card", institution: "Ueno", name: "Visa", currency: "PYG", currentBalance: 50000 },
        { id: "available-usd", spaceId: "personal-1", accountType: "bank", institution: "GNB", name: "Dólares", currency: "USD", currentBalance: 100 },
        { id: "credit-usd", spaceId: "personal-1", accountType: "credit_card", institution: "GNB", name: "Mastercard", currency: "USD", currentBalance: 20 },
      ],
      transactions: [],
    });

    render(<PersonalDashboard />);

    expect(await screen.findByRole("heading", { level: 1, name: "Patrimonio neto" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Resumen en PYG")).getByText(/PYG.*400\.000/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Resumen en USD")).getByText(/USD.*80,00/)).toBeInTheDocument();
    expect(screen.getByText("Tarjetas por pagar")).toBeInTheDocument();
    expect(screen.getByText("Ueno · Crédito")).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente")).toHaveLength(2);
  });

  it("masks actual values without masking their labels", async () => {
    window.localStorage.setItem("mis-finanzas:balances-hidden", "true");
    mockedLoadPersonalLedger.mockResolvedValue({
      accounts: [{ id: "available-1", spaceId: "personal-1", accountType: "bank", institution: "Ueno", name: "Cuenta", currency: "PYG", currentBalance: 450000 }],
      transactions: [],
    });

    render(<PersonalDashboard />);

    expect(await screen.findByRole("heading", { level: 1, name: "Patrimonio neto" })).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.getAllByText("••••••").length).toBeGreaterThan(0);
    expect(screen.queryByText(/PYG.*450\.000/)).not.toBeInTheDocument();
  });

  it("uses each movement's derived currency", async () => {
    mockedLoadPersonalLedger.mockResolvedValue({
      accounts: [{ id: "usd-1", spaceId: "personal-1", accountType: "bank", institution: "GNB", name: "Dólares", currency: "USD", currentBalance: 100 }],
      transactions: [{ id: "income-1", operationType: "income", sourceAccountId: null, destinationAccountId: "usd-1", amount: 25.5, currency: "USD", occurredOn: "2026-09-01", category: "Freelance", note: null, merchant: null, items: [] }],
    });

    render(<PersonalDashboard />);

    expect(await screen.findByText("Freelance")).toBeInTheDocument();
    expect(screen.getByText(/USD.*25,50/)).toBeInTheDocument();
  });

  it("keeps labels visible while personal data is loading", () => {
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
    mockedLoadPersonalLedger.mockRejectedValueOnce(new Error("internal detail")).mockResolvedValueOnce({ accounts: [], transactions: [] });
    render(<PersonalDashboard />);
    expect(await screen.findByText("No pudimos cargar tus finanzas personales. Volvé a intentar.")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Reintentar" }));
    await waitFor(() => expect(screen.getByText("Todavía no tenés cuentas personales para resumir.")).toBeInTheDocument());
    expect(screen.queryByText("internal detail")).not.toBeInTheDocument();
  });
});
