import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AccountsContent } from "@/components/accounts/accounts-content";
import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/finance/personal-ledger", () => ({ loadPersonalLedger: vi.fn() }));
vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedLoadPersonalLedger = vi.mocked(loadPersonalLedger);
const mockedCreateClient = vi.mocked(createClient);

afterEach(() => {
  cleanup();
  window.localStorage.removeItem("mis-finanzas:balances-hidden");
  mockedLoadPersonalLedger.mockReset();
  mockedCreateClient.mockReset();
});

describe("AccountsContent", () => {
  it("keeps the account success confirmation visible after refreshing the parent list", async () => {
    mockedLoadPersonalLedger
      .mockResolvedValueOnce({ accounts: [], transactions: [] })
      .mockResolvedValueOnce({ accounts: [{ id: "cash-1", spaceId: "personal-1", accountType: "cash", institution: "Ueno", name: "Efectivo", currency: "PYG", currentBalance: 0 }], transactions: [] });
    const insert = vi.fn().mockResolvedValue({ error: null });
    const maybeSingle = vi.fn().mockResolvedValue({ data: { id: "personal-1" }, error: null });
    const eq = vi.fn().mockReturnValue({ maybeSingle });
    const select = vi.fn().mockReturnValue({ eq });
    mockedCreateClient.mockReturnValue({ from: vi.fn((table: string) => table === "financial_spaces" ? { select } : { insert }) } as never);

    render(<AccountsContent />);
    fireEvent.change(await screen.findByLabelText("Nombre"), { target: { value: "Efectivo" } });
    fireEvent.submit(screen.getByRole("button", { name: "Crear cuenta" }).closest("form")!);

    expect(await screen.findByText("Cuenta creada.")).toBeInTheDocument();
    expect(await screen.findByText("Ueno · Efectivo")).toBeInTheDocument();
    expect(mockedLoadPersonalLedger).toHaveBeenCalledTimes(2);
  });
});
