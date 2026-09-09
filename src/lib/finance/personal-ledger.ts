import { parsePersonalLedgerPayload, personalLedgerLoadError } from "@/lib/finance/ledger-payload";
import { createClient } from "@/lib/supabase/client";
import type {
  OperationType,
  PersonalAccount,
  PersonalLedger,
  PersonalTransactionDraft,
  PurchaseItem,
  PurchaseItemDraft,
} from "@/lib/finance/types";

const saveError = "No pudimos guardar la operación. Revisá los datos e intentá de nuevo.";
const itemError = "Revisá los ítems de compra.";

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
    const { data, error } = await createClient().rpc("get_personal_ledger", { p_limit: 200 });
    if (error) throw new Error(personalLedgerLoadError);
    return parsePersonalLedgerPayload(data);
  } catch {
    throw new Error(personalLedgerLoadError);
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
      p_items: items.map((item) => ({
        description: item.description,
        quantity: item.quantity,
        unit_price: item.unitPrice,
      })),
      p_client_operation_id: draft.clientOperationId ?? crypto.randomUUID(),
    });

    if (error || typeof data !== "string") throw new Error(saveError);
    return data;
  } catch {
    throw new Error(saveError);
  }
}
