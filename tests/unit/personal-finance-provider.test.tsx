import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PersonalFinanceProvider, usePersonalFinance } from "@/components/finance/personal-finance-provider";

const { loadPersonalLedger } = vi.hoisted(() => ({ loadPersonalLedger: vi.fn() }));

vi.mock("@/lib/finance/personal-ledger", () => ({ loadPersonalLedger }));

const initialLedger = {
  accounts: [{
    id: "account-1",
    spaceId: "space-1",
    accountType: "bank" as const,
    institution: "Banco",
    name: "Caja",
    currency: "PYG",
    currentBalance: 500000,
  }],
  transactions: [],
};

function LedgerReader() {
  const { ledger } = usePersonalFinance();
  return <p>{ledger.accounts[0]?.name}</p>;
}

function RefreshableLedgerReader() {
  const { ledger, refresh } = usePersonalFinance();

  return <>
    <p>{ledger.accounts[0]?.name}</p>
    <button onClick={() => void refresh()} type="button">Actualizar</button>
  </>;
}

describe("PersonalFinanceProvider", () => {
  it("renders the initial ledger synchronously without a loading-only state", () => {
    render(
      <PersonalFinanceProvider initialLedger={initialLedger} userId="user-1">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );

    expect(screen.getByText("Caja")).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it("keeps a new server snapshot visible after a prior provider refresh", async () => {
    const refreshedLedger = {
      ...initialLedger,
      accounts: [{ ...initialLedger.accounts[0]!, name: "Caché anterior" }],
    };
    const freshServerLedger = {
      ...initialLedger,
      accounts: [{ ...initialLedger.accounts[0]!, name: "Servidor nuevo" }],
    };
    loadPersonalLedger.mockResolvedValue(refreshedLedger);

    const firstRender = render(
      <PersonalFinanceProvider initialLedger={initialLedger} userId="user-refresh">
        <RefreshableLedgerReader />
      </PersonalFinanceProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(screen.getByText("Caché anterior")).toBeInTheDocument());
    firstRender.unmount();

    render(
      <PersonalFinanceProvider initialLedger={freshServerLedger} userId="user-refresh">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );

    expect(screen.getByText("Servidor nuevo")).toBeInTheDocument();
  });
});
