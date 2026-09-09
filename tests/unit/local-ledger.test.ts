import { describe, expect, it } from "vitest";

import { applyPendingTransaction } from "@/lib/finance/local-ledger";
import type { PersonalLedger, PersonalTransactionDraft } from "@/lib/finance/types";

const ledger: PersonalLedger = {
  accounts: [
    { id: "cash-1", spaceId: "space-1", accountType: "cash", institution: "Otro", name: "Efectivo", currency: "PYG", currentBalance: 500 },
    { id: "bank-1", spaceId: "space-1", accountType: "bank", institution: "Banco", name: "Banco", currency: "PYG", currentBalance: 1000 },
    { id: "card-1", spaceId: "space-1", accountType: "credit_card", institution: "Banco", name: "Visa", currency: "PYG", currentBalance: 200 },
  ],
  transactions: [],
};

function draft(operationType: PersonalTransactionDraft["operationType"], sourceAccountId: string | null, destinationAccountId: string | null): PersonalTransactionDraft {
  return { operationType, sourceAccountId, destinationAccountId, amount: 100, occurredOn: "2026-09-09", clientOperationId: "22222222-2222-4222-8222-222222222222" };
}

function balance(next: PersonalLedger, accountId: string) {
  return next.accounts.find((account) => account.id === accountId)?.currentBalance;
}

describe("applyPendingTransaction", () => {
  it.each([
    ["income", null, "cash-1", 600, 1000, 200],
    ["expense", "cash-1", null, 400, 1000, 200],
    ["card_purchase", "card-1", null, 500, 1000, 300],
    ["transfer", "cash-1", "bank-1", 400, 1100, 200],
    ["card_payment", "cash-1", "card-1", 400, 1000, 100],
  ] as const)("applies the %s account-balance delta", (operationType, sourceAccountId, destinationAccountId, cash, bank, card) => {
    const next = applyPendingTransaction(ledger, draft(operationType, sourceAccountId, destinationAccountId), "pending-1");

    expect(balance(next, "cash-1")).toBe(cash);
    expect(balance(next, "bank-1")).toBe(bank);
    expect(balance(next, "card-1")).toBe(card);
    expect(ledger).toEqual({ ...ledger, accounts: ledger.accounts, transactions: [] });
  });

  it("uses the stable pending client ID, normalizes purchase items, and prevents duplicates", () => {
    const next = applyPendingTransaction(ledger, {
      ...draft("expense", "cash-1", null),
      category: "Comida",
      items: [{ description: " Leche ", quantity: "2", unitPrice: "50" }],
    }, "pending-1");

    expect(next.transactions[0]).toMatchObject({
      id: "pending:22222222-2222-4222-8222-222222222222",
      clientOperationId: "22222222-2222-4222-8222-222222222222",
      syncStatus: "pending",
      currency: "PYG",
      items: [{ description: "Leche", quantity: 2, unitPrice: 50 }],
    });
    expect(applyPendingTransaction(next, draft("expense", "cash-1", null), "pending-2")).toBe(next);
  });
});
