import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { PersonalFinanceProvider, usePersonalFinance } from "@/components/finance/personal-finance-provider";

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
});
