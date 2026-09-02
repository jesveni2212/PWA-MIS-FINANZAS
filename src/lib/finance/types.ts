export type AccountType = "cash" | "bank" | "credit_card";

export type OperationType = "income" | "expense" | "card_purchase" | "transfer" | "card_payment";

export type PurchaseItemDraft = {
  description: string;
  quantity: string;
  unitPrice: string;
};

export type PurchaseItem = {
  id?: string;
  transactionId?: string;
  description: string;
  quantity: number;
  unitPrice: number;
};

export type PersonalAccount = {
  id: string;
  spaceId: string;
  accountType: AccountType;
  institution: string;
  name: string;
  currency: string;
  currentBalance: number;
};

export type PersonalTransaction = {
  id: string;
  operationType: OperationType;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  amount: number;
  occurredOn: string;
  category: string | null;
  note: string | null;
  merchant: string | null;
  items: PurchaseItem[];
};

export type PersonalLedger = {
  accounts: PersonalAccount[];
  transactions: PersonalTransaction[];
};

export type PersonalTransactionDraft = {
  operationType: OperationType;
  sourceAccountId: string | null;
  destinationAccountId: string | null;
  amount: number;
  occurredOn: string;
  category?: string | null;
  note?: string | null;
  merchant?: string | null;
  items?: PurchaseItemDraft[];
};

