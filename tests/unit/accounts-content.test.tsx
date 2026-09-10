import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { AccountsContent } from "@/components/accounts/accounts-content";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/finance/personal-ledger", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/finance/personal-ledger")>(),
  loadPersonalLedger: vi.fn(),
}));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedLoadPersonalLedger = vi.mocked(loadPersonalLedger);
const mockedCreateClient = vi.mocked(createClient);
const emptyLedger = { accounts: [], transactions: [] };
const populatedLedger = { accounts: [{ id: "cash-1", spaceId: "personal-1", accountType: "cash" as const, institution: "Ueno", name: "Efectivo", currency: "PYG", currentBalance: 0 }], transactions: [] };

beforeEach(() => {
  Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
  mockedLoadPersonalLedger.mockReset();
  mockedCreateClient.mockReset();
});

afterEach(() => cleanup());

describe("AccountsContent", () => {
  it("renders the server ledger and refreshes it after account creation", async () => {
    mockedLoadPersonalLedger.mockResolvedValueOnce(emptyLedger).mockResolvedValueOnce(populatedLedger);
    const insert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "personal-1" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockedCreateClient.mockReturnValue({ from: vi.fn(() => ({ select, insert })) } as never);

    render(
      <PersonalFinanceProvider initialLedger={emptyLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="accounts-test">
        <AccountsContent />
      </PersonalFinanceProvider>,
    );
    expect(screen.getByText("Todavía no creaste cuentas disponibles.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Nombre"), { target: { value: "Efectivo" } });
    fireEvent.submit(screen.getByRole("button", { name: "Crear cuenta" }).closest("form")!);

    expect(await screen.findByText("Cuenta creada.")).toBeInTheDocument();
    expect(await screen.findByText("Ueno · Efectivo")).toBeInTheDocument();
    expect(mockedLoadPersonalLedger).toHaveBeenCalledTimes(2);
  });
});
