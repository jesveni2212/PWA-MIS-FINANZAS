import { beforeEach, describe, expect, it, vi } from "vitest";
import { parsePersonalLedgerPayload } from "@/lib/finance/ledger-payload";
import { loadPersonalLedger, normalizePurchaseItems, recordPersonalTransaction, validateOperationAccounts } from "@/lib/finance/personal-ledger";
import type { PersonalAccount } from "@/lib/finance/types";
import { createClient } from "@/lib/supabase/client";

vi.mock("@/lib/supabase/client", () => ({ createClient: vi.fn() }));

const mockedCreateClient = vi.mocked(createClient);

const accounts: PersonalAccount[] = [
  { id: "cash-1", spaceId: "personal-1", accountType: "cash", institution: "Otro", name: "Efectivo", currency: "PYG", currentBalance: 150000 },
  { id: "credit-1", spaceId: "personal-1", accountType: "credit_card", institution: "Ueno", name: "Visa", currency: "PYG", currentBalance: 50000 },
  { id: "usd-1", spaceId: "personal-1", accountType: "bank", institution: "GNB", name: "Dólares", currency: "USD", currentBalance: 100 },
];

describe("personal ledger helpers", () => {
  beforeEach(() => {
    mockedCreateClient.mockReset();
    vi.unstubAllGlobals();
  });

  it("accepts an empty grouped ledger payload", () => {
    expect(parsePersonalLedgerPayload({ accounts: [], transactions: [] })).toEqual({ accounts: [], transactions: [] });
  });

  it("rejects malformed grouped ledger payloads with the generic ledger error", () => {
    expect(() => parsePersonalLedgerPayload({ accounts: [], transactions: null }))
      .toThrow("No pudimos cargar tus finanzas personales. Volvé a intentar.");
  });

  it("normalizes grouped ledger rows and defaults missing purchase items", () => {
    expect(parsePersonalLedgerPayload({
      accounts: [{ id: "cash-1", space_id: "personal-1", account_type: "cash", institution: "Otro", name: "Efectivo", currency: "PYG", current_balance: "150000" }],
      transactions: [{ id: "transaction-1", operation_type: "expense", source_account_id: "cash-1", destination_account_id: null, amount: "8500", occurred_on: "2026-09-01", category: null, note: null, merchant: null }],
    })).toEqual({
      accounts: [accounts[0]],
      transactions: [{ id: "transaction-1", operationType: "expense", sourceAccountId: "cash-1", destinationAccountId: null, amount: 8500, currency: "PYG", occurredOn: "2026-09-01", category: null, note: null, merchant: null, items: [] }],
    });
  });

  it("normalizes structured purchase items", () => {
    expect(normalizePurchaseItems([{ description: "  Leche ", quantity: "2", unitPrice: "8500" }]))
      .toEqual([{ description: "Leche", quantity: 2, unitPrice: 8500 }]);
  });

  it("rejects invalid purchase items with a generic message", () => {
    expect(() => normalizePurchaseItems([{ description: "", quantity: "0", unitPrice: "8500" }]))
      .toThrow("Revisá los ítems de compra.");
  });

  it("validates account combinations before calling the RPC", () => {
    expect(validateOperationAccounts("card_payment", "cash-1", "credit-1", accounts)).toBeNull();
    expect(validateOperationAccounts("card_payment", "credit-1", "cash-1", accounts)).toMatch(/origen/i);
    expect(validateOperationAccounts("transfer", "cash-1", "usd-1", accounts)).toMatch(/misma moneda/i);
  });

  it("loads the personal ledger with one grouped RPC call", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: {
      accounts: [{ id: "cash-1", space_id: "personal-1", account_type: "cash", institution: "Otro", name: "Efectivo", currency: "PYG", current_balance: "150000" }],
      transactions: [{ id: "transaction-1", operation_type: "expense", source_account_id: "cash-1", destination_account_id: null, amount: "8500", occurred_on: "2026-09-01", category: "Comida", note: null, merchant: "Biggie", items: [{ id: "item-1", transaction_id: "transaction-1", description: "Leche", quantity: "2", unit_price: "4250" }] }],
    }, error: null });
    mockedCreateClient.mockReturnValue({ rpc } as never);

    await expect(loadPersonalLedger()).resolves.toEqual({
      accounts: [accounts[0]],
      transactions: [{ id: "transaction-1", operationType: "expense", sourceAccountId: "cash-1", destinationAccountId: null, amount: 8500, currency: "PYG", occurredOn: "2026-09-01", category: "Comida", note: null, merchant: "Biggie", items: [{ id: "item-1", transactionId: "transaction-1", description: "Leche", quantity: 2, unitPrice: 4250 }] }],
    });
    expect(rpc).toHaveBeenCalledWith("get_personal_ledger", { p_limit: 200 });
  });

  it("uses the sole personal-transaction RPC, preserves a client operation ID, and keeps Supabase errors generic", async () => {
    const rpc = vi.fn().mockResolvedValue({ data: "transaction-1", error: null });
    mockedCreateClient.mockReturnValue({ rpc } as never);

    await expect(recordPersonalTransaction({
      operationType: "card_payment", sourceAccountId: "cash-1", destinationAccountId: "credit-1", amount: 50000, occurredOn: "2026-09-01", note: "  Pago mensual ", items: [{ description: "  Cuota ", quantity: "1", unitPrice: "50000" }], clientOperationId: "11111111-1111-4111-8111-111111111111",
    }, accounts)).resolves.toBe("transaction-1");
    expect(rpc).toHaveBeenCalledWith("record_personal_transaction", expect.objectContaining({
      p_operation_type: "card_payment", p_note: "Pago mensual", p_items: [{ description: "Cuota", quantity: 1, unit_price: 50000 }], p_client_operation_id: "11111111-1111-4111-8111-111111111111",
    }));

    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("22222222-2222-4222-8222-222222222222") });
    await recordPersonalTransaction({ operationType: "expense", sourceAccountId: "cash-1", destinationAccountId: null, amount: 1, occurredOn: "2026-09-01" }, accounts);
    expect(rpc).toHaveBeenLastCalledWith("record_personal_transaction", expect.objectContaining({
      p_client_operation_id: "22222222-2222-4222-8222-222222222222",
    }));

    rpc.mockResolvedValueOnce({ data: null, error: { message: "internal database detail" } });
    await expect(recordPersonalTransaction({ operationType: "expense", sourceAccountId: "cash-1", destinationAccountId: null, amount: 1, occurredOn: "2026-09-01" }, accounts))
      .rejects.toThrow("No pudimos guardar la operación. Revisá los datos e intentá de nuevo.");
  });
});
