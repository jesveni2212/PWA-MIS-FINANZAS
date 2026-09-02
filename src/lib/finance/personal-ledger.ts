import { createClient } from "@/lib/supabase/client";
import type {
  AccountType,
  OperationType,
  PersonalAccount,
  PersonalLedger,
  PersonalTransaction,
  PersonalTransactionDraft,
  PurchaseItem,
  PurchaseItemDraft,
} from "@/lib/finance/types";

type BalanceRow = {
  id: string;
  space_id: string;
  account_type: AccountType;
  institution: string;
  name: string;
  currency: string;
  current_balance: number | string;
};

type TransactionRow = {
  id: string;
  operation_type: OperationType;
  source_account_id: string | null;
  destination_account_id: string | null;
  amount: number | string;
  occurred_on: string;
  category: string | null;
  note: string | null;
  merchant: string | null;
};

type ItemRow = {
  id: string;
  transaction_id: string;
  description: string;
  quantity: number | string;
  unit_price: number | string;
};

const loadError = "No pudimos cargar tus finanzas personales. Volvé a intentar.";
const saveError = "No pudimos guardar la operación. Revisá los datos e intentá de nuevo.";
const itemError = "Revisá los ítems de compra.";

function numberValue(value: number | string): number {
  return Number(value);
}

function nullableText(value: string | null | undefined): string | null {
  const normalized = value?.trim();
  return normalized || null;
}

export function normalizePurchaseItems(items: PurchaseItemDraft[]): PurchaseItem[] {
  return items.map((item) => {
    const description = item.description.trim();
    const quantity = Number(item.quantity);
    const unitPrice = Number(item.unitPrice);

    if (!description || !Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice < 0) {
      throw new Error(itemError);
    }

    return { description, quantity, unitPrice };
  });
}

export function validateOperationAccounts(
  operationType: OperationType,
  sourceAccountId: string | null,
  destinationAccountId: string | null,
  accounts: PersonalAccount[],
): string | null {
  const source = sourceAccountId ? accounts.find((account) => account.id === sourceAccountId) : undefined;
  const destination = destinationAccountId ? accounts.find((account) => account.id === destinationAccountId) : undefined;
  const validSource = source && source.accountType !== "credit_card";
  const validDestination = destination && destination.accountType !== "credit_card";

  if (operationType === "income") {
    return sourceAccountId || !validDestination ? "Seleccioná una cuenta de destino disponible válida." : null;
  }

  if (operationType === "expense") {
    return !validSource || destinationAccountId ? "Seleccioná una cuenta de origen disponible válida." : null;
  }

  if (operationType === "card_purchase") {
    return !source || source.accountType !== "credit_card" || destinationAccountId
      ? "Seleccioná una tarjeta de crédito válida." : null;
  }

  if (!source || !destination || sourceAccountId === destinationAccountId) {
    return "Seleccioná cuentas de origen y destino diferentes.";
  }

  if (operationType === "transfer") {
    if (!validSource) return "Seleccioná una cuenta de origen disponible válida.";
    if (!validDestination) return "Seleccioná una cuenta de destino disponible válida.";
  } else if (operationType === "card_payment") {
    if (!validSource) return "Seleccioná una cuenta de origen disponible válida.";
    if (destination.accountType !== "credit_card") return "Seleccioná una tarjeta de destino válida.";
  }

  return source.currency !== destination.currency ? "Las cuentas deben usar la misma moneda." : null;
}

export async function loadPersonalLedger(): Promise<PersonalLedger> {
  try {
    const client = createClient();
    const { data: space, error: spaceError } = await client
    .from("financial_spaces")
    .select("id")
    .eq("kind", "personal")
    .maybeSingle();

    if (spaceError || !space) throw new Error(loadError);

    const [{ data: balances, error: balancesError }, { data: transactions, error: transactionsError }] = await Promise.all([
      client.from("personal_account_balances").select("id,space_id,account_type,institution,name,currency,current_balance").eq("space_id", space.id).order("name"),
      client.from("personal_transactions").select("id,operation_type,source_account_id,destination_account_id,amount,occurred_on,category,note,merchant").eq("personal_space_id", space.id).order("occurred_on", { ascending: false }).order("id", { ascending: false }),
    ]);

    if (balancesError || transactionsError) throw new Error(loadError);

    const transactionRows = (transactions ?? []) as TransactionRow[];
    const transactionIds = transactionRows.map((transaction) => transaction.id);
    let itemRows: ItemRow[] = [];

    if (transactionIds.length > 0) {
      const { data: items, error: itemsError } = await client
        .from("purchase_items")
        .select("id,transaction_id,description,quantity,unit_price")
        .in("transaction_id", transactionIds);
      if (itemsError) throw new Error(loadError);
      itemRows = (items ?? []) as ItemRow[];
    }

    const itemsByTransaction = new Map<string, PurchaseItem[]>();
    for (const item of itemRows) {
      const transactionItems = itemsByTransaction.get(item.transaction_id) ?? [];
      transactionItems.push({ id: item.id, transactionId: item.transaction_id, description: item.description, quantity: numberValue(item.quantity), unitPrice: numberValue(item.unit_price) });
      itemsByTransaction.set(item.transaction_id, transactionItems);
    }

    return {
      accounts: ((balances ?? []) as BalanceRow[]).map((account) => ({
        id: account.id,
        spaceId: account.space_id,
        accountType: account.account_type,
        institution: account.institution,
        name: account.name,
        currency: account.currency,
        currentBalance: numberValue(account.current_balance),
      })),
      transactions: transactionRows.map((transaction): PersonalTransaction => ({
        id: transaction.id,
        operationType: transaction.operation_type,
        sourceAccountId: transaction.source_account_id,
        destinationAccountId: transaction.destination_account_id,
        amount: numberValue(transaction.amount),
        occurredOn: transaction.occurred_on,
        category: transaction.category,
        note: transaction.note,
        merchant: transaction.merchant,
        items: itemsByTransaction.get(transaction.id) ?? [],
      })),
    };
  } catch {
    throw new Error(loadError);
  }
}

export async function recordPersonalTransaction(draft: PersonalTransactionDraft, accounts: PersonalAccount[]): Promise<string> {
  const validationError = validateOperationAccounts(draft.operationType, draft.sourceAccountId, draft.destinationAccountId, accounts);
  if (validationError) throw new Error(validationError);
  if (!Number.isFinite(draft.amount) || draft.amount <= 0 || !draft.occurredOn) throw new Error(saveError);

  const items = normalizePurchaseItems(draft.items ?? []);
  try {
    const { data, error } = await createClient().rpc("record_personal_transaction", {
      p_operation_type: draft.operationType,
      p_source_account_id: draft.sourceAccountId,
      p_destination_account_id: draft.destinationAccountId,
      p_amount: draft.amount,
      p_occurred_on: draft.occurredOn,
      p_category: nullableText(draft.category),
      p_note: nullableText(draft.note),
      p_merchant: nullableText(draft.merchant),
      p_items: items.map((item) => ({ description: item.description, quantity: item.quantity, unit_price: item.unitPrice })),
    });

    if (error || typeof data !== "string") throw new Error(saveError);
    return data;
  } catch {
    throw new Error(saveError);
  }
}
