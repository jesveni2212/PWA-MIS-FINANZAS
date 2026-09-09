import { normalizePurchaseItems } from "@/lib/finance/personal-ledger";
import type { PersonalLedger, PersonalTransaction, PersonalTransactionDraft } from "@/lib/finance/types";

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function applyPendingTransaction(ledger: PersonalLedger, draft: PersonalTransactionDraft, _pendingId: string): PersonalLedger {
  const clientOperationId = draft.clientOperationId;
  if (!clientOperationId || ledger.transactions.some((transaction) => transaction.clientOperationId === clientOperationId || transaction.id === `pending:${clientOperationId}`)) {
    return ledger;
  }

  const accounts = ledger.accounts.map((account) => ({ ...account }));
  const source = draft.sourceAccountId ? accounts.find((account) => account.id === draft.sourceAccountId) : undefined;
  const destination = draft.destinationAccountId ? accounts.find((account) => account.id === draft.destinationAccountId) : undefined;
  const amount = draft.amount;
  const deltas = new Map<string, number>();
  const addDelta = (accountId: string | null, delta: number) => {
    if (accountId) deltas.set(accountId, (deltas.get(accountId) ?? 0) + delta);
  };

  if (draft.operationType === "income") addDelta(draft.destinationAccountId, amount);
  if (draft.operationType === "expense") addDelta(draft.sourceAccountId, -amount);
  if (draft.operationType === "card_purchase") addDelta(draft.sourceAccountId, amount);
  if (draft.operationType === "transfer") {
    addDelta(draft.sourceAccountId, -amount);
    addDelta(draft.destinationAccountId, amount);
  }
  if (draft.operationType === "card_payment") {
    addDelta(draft.sourceAccountId, -amount);
    addDelta(draft.destinationAccountId, -amount);
  }

  const transaction: PersonalTransaction = {
    id: `pending:${clientOperationId}`,
    clientOperationId,
    syncStatus: "pending",
    operationType: draft.operationType,
    sourceAccountId: draft.sourceAccountId,
    destinationAccountId: draft.destinationAccountId,
    amount,
    currency: source?.currency ?? destination?.currency ?? null,
    occurredOn: draft.occurredOn,
    category: nullableText(draft.category),
    note: nullableText(draft.note),
    merchant: nullableText(draft.merchant),
    items: normalizePurchaseItems(draft.items ?? []),
  };

  return {
    accounts: accounts.map((account) => ({ ...account, currentBalance: account.currentBalance + (deltas.get(account.id) ?? 0) })),
    transactions: [transaction, ...ledger.transactions.map((existing) => ({ ...existing, items: [...existing.items] }))],
  };
}
