import type {
  AccountType,
  OperationType,
  PersonalAccount,
  PersonalLedger,
  PersonalTransaction,
  PurchaseItem,
} from "@/lib/finance/types";

export const personalLedgerLoadError = "No pudimos cargar tus finanzas personales. Volvé a intentar.";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAccountType(value: unknown): value is AccountType {
  return value === "cash" || value === "bank" || value === "credit_card";
}

function isOperationType(value: unknown): value is OperationType {
  return value === "income" || value === "expense" || value === "card_purchase" || value === "transfer" || value === "card_payment";
}

function requiredText(value: unknown): string {
  if (typeof value !== "string") throw new Error(personalLedgerLoadError);
  return value;
}

function nullableText(value: unknown): string | null {
  if (value !== null && typeof value !== "string") throw new Error(personalLedgerLoadError);
  return value;
}

function numberValue(value: unknown): number {
  if ((typeof value !== "number" && typeof value !== "string") || value === "") throw new Error(personalLedgerLoadError);
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(personalLedgerLoadError);
  return number;
}

function nullableId(value: unknown): string | null {
  return nullableText(value);
}

function parsePurchaseItem(value: unknown): PurchaseItem {
  if (!isRecord(value)) throw new Error(personalLedgerLoadError);
  const id = value.id === undefined ? undefined : requiredText(value.id);
  const transactionId = value.transaction_id === undefined ? undefined : requiredText(value.transaction_id);

  return {
    ...(id === undefined ? {} : { id }),
    ...(transactionId === undefined ? {} : { transactionId }),
    description: requiredText(value.description),
    quantity: numberValue(value.quantity),
    unitPrice: numberValue(value.unit_price),
  };
}

export function parsePersonalLedgerPayload(payload: unknown): PersonalLedger {
  try {
    if (!isRecord(payload) || !Array.isArray(payload.accounts) || !Array.isArray(payload.transactions)) {
      throw new Error(personalLedgerLoadError);
    }

    const accounts: PersonalAccount[] = payload.accounts.map((value) => {
      if (!isRecord(value) || !isAccountType(value.account_type)) throw new Error(personalLedgerLoadError);

      return {
        id: requiredText(value.id),
        spaceId: requiredText(value.space_id),
        accountType: value.account_type,
        institution: requiredText(value.institution),
        name: requiredText(value.name),
        currency: requiredText(value.currency),
        currentBalance: numberValue(value.current_balance),
      };
    });
    const currencyByAccountId = new Map(accounts.map((account) => [account.id, account.currency]));
    const transactions: PersonalTransaction[] = payload.transactions.map((value) => {
      if (!isRecord(value) || !isOperationType(value.operation_type)) throw new Error(personalLedgerLoadError);
      const sourceAccountId = nullableId(value.source_account_id);
      const destinationAccountId = nullableId(value.destination_account_id);
      const items = value.items === undefined ? [] : value.items;
      if (!Array.isArray(items)) throw new Error(personalLedgerLoadError);

      return {
        id: requiredText(value.id),
        operationType: value.operation_type,
        sourceAccountId,
        destinationAccountId,
        amount: numberValue(value.amount),
        currency: currencyByAccountId.get(sourceAccountId ?? "") ?? currencyByAccountId.get(destinationAccountId ?? "") ?? null,
        occurredOn: requiredText(value.occurred_on),
        category: nullableText(value.category),
        note: nullableText(value.note),
        merchant: nullableText(value.merchant),
        items: items.map(parsePurchaseItem),
      };
    });

    return { accounts, transactions };
  } catch {
    throw new Error(personalLedgerLoadError);
  }
}
