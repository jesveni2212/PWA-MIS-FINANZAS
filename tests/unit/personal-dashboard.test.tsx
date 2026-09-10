import { cleanup, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import type { PersonalLedger } from "@/lib/finance/types";
import type { ReminderWithOccurrence } from "@/lib/reminders/types";

vi.mock("@/lib/finance/personal-ledger", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/finance/personal-ledger")>(),
  loadPersonalLedger: vi.fn(),
}));

const mockedLoadPersonalLedger = vi.mocked(loadPersonalLedger);
const initialLedger: PersonalLedger = { accounts: [], transactions: [] };

function renderDashboard(ledger: PersonalLedger, initialReminders: ReminderWithOccurrence[] = []) {
  return render(
    <PersonalFinanceProvider initialLedger={ledger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="dashboard-test">
      <PersonalDashboard initialReminders={initialReminders} />
    </PersonalFinanceProvider>,
  );
}

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
  mockedLoadPersonalLedger.mockReset();
});

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("mis-finanzas:balances-hidden");
});

describe("PersonalDashboard", () => {
  it("keeps PYG and USD balances separate while showing cards due", () => {
    const ledger = {
      accounts: [
        { id: "available-pyg", spaceId: "personal-1", accountType: "bank" as const, institution: "Ueno", name: "Cuenta", currency: "PYG", currentBalance: 450000 },
        { id: "credit-pyg", spaceId: "personal-1", accountType: "credit_card" as const, institution: "Ueno", name: "Visa", currency: "PYG", currentBalance: 50000 },
        { id: "available-usd", spaceId: "personal-1", accountType: "bank" as const, institution: "GNB", name: "Dólares", currency: "USD", currentBalance: 100 },
        { id: "credit-usd", spaceId: "personal-1", accountType: "credit_card" as const, institution: "GNB", name: "Mastercard", currency: "USD", currentBalance: 20 },
      ],
      transactions: [],
    };
    renderDashboard(ledger);

    expect(screen.getByRole("heading", { level: 1, name: "Patrimonio neto" })).toBeInTheDocument();
    expect(within(screen.getByLabelText("Resumen en PYG")).getByText(/PYG.*400\.000/)).toBeInTheDocument();
    expect(within(screen.getByLabelText("Resumen en USD")).getByText(/USD.*80,00/)).toBeInTheDocument();
    expect(screen.getByText("Tarjetas por pagar")).toBeInTheDocument();
    expect(screen.getByText("Ueno · Crédito")).toBeInTheDocument();
    expect(screen.getAllByText("Pendiente")).toHaveLength(2);
  });

  it("masks actual values without masking their labels", () => {
    window.localStorage.setItem("mis-finanzas:balances-hidden", "true");
    renderDashboard({ accounts: [{ id: "available-1", spaceId: "personal-1", accountType: "bank", institution: "Ueno", name: "Cuenta", currency: "PYG", currentBalance: 450000 }], transactions: [] });

    expect(screen.getByRole("heading", { level: 1, name: "Patrimonio neto" })).toBeInTheDocument();
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.getAllByText("••••••").length).toBeGreaterThan(0);
    expect(screen.queryByText(/PYG.*450\.000/)).not.toBeInTheDocument();
  });

  it("uses each movement's derived currency", () => {
    renderDashboard({
      accounts: [{ id: "usd-1", spaceId: "personal-1", accountType: "bank", institution: "GNB", name: "Dólares", currency: "USD", currentBalance: 100 }],
      transactions: [{ id: "income-1", operationType: "income", sourceAccountId: null, destinationAccountId: "usd-1", amount: 25.5, currency: "USD", occurredOn: "2026-09-01", category: "Freelance", note: null, merchant: null, items: [] }],
    });

    expect(screen.getByText("Freelance")).toBeInTheDocument();
    expect(screen.getByText(/USD.*25,50/)).toBeInTheDocument();
  });

  it("renders the server-provided ledger immediately without a loading state", () => {
    renderDashboard({ accounts: [{ id: "cash", spaceId: "personal-1", accountType: "cash", institution: "Ueno", name: "Caja inicial", currency: "PYG", currentBalance: 1 }], transactions: [] });
    expect(screen.getByText("Disponible")).toBeInTheDocument();
    expect(screen.queryByText(/Cargando resumen personal/)).not.toBeInTheDocument();
  });

  it("explains when the personal ledger has no accounts", () => {
    renderDashboard(initialLedger);
    expect(screen.getByText("Todavía no tenés cuentas personales para resumir.")).toBeInTheDocument();
  });

  it("shows the nearest pending reminder without creating a movement", () => {
    renderDashboard(initialLedger, [{
      reminder: { id: "reminder-1", name: "Luz", category: "Servicios", amount: 50000, currency: "PYG", recurrenceType: "monthly", recurrenceRule: { type: "monthly", day: 31 }, startDate: "2026-09-01", nextDueOn: "2026-09-30", notifyDaysBefore: 3, timezone: "America/Asuncion", active: true, createdAt: "2026-09-01T00:00:00Z", updatedAt: "2026-09-01T00:00:00Z" },
      occurrence: { id: "occurrence-1", reminderId: "reminder-1", dueOn: "2026-09-30", status: "pending", resolvedAt: null },
    }]);

    expect(screen.getByText("Próximo recordatorio")).toBeInTheDocument();
    expect(screen.getByText("Luz")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Ver recordatorios" })).toHaveAttribute("href", "/recordatorios");
  });

});
