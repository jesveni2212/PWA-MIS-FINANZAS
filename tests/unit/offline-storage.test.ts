import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  OFFLINE_DATABASE_NAME,
  OFFLINE_DATABASE_VERSION,
  OfflineStorageUnavailableError,
  clearUserData,
  enqueueTransaction,
  listPendingTransactions,
  readLedgerCache,
  resetOfflineStorageAdapterForTests,
  setOfflineStorageAdapterForTests,
  writeLedgerCache,
  type OfflineStorageAdapter,
} from "@/lib/offline/storage";
import type { PersonalLedger } from "@/lib/finance/types";

const ledger: PersonalLedger = { accounts: [], transactions: [] };

function adapter(): OfflineStorageAdapter & { version: number } {
  const ledgers = new Map<string, { userId: string; ledger: PersonalLedger; updatedAt: string }>();
  const outbox = new Map<string, Awaited<ReturnType<typeof enqueueTransaction>>>();
  return {
    version: OFFLINE_DATABASE_VERSION,
    readLedger: async (userId) => ledgers.get(userId) ?? null,
    writeLedger: async (record) => { ledgers.set(record.userId, record); },
    addOutbox: async (record) => { outbox.set(record.id, record); },
    listOutbox: async (userId) => [...outbox.values()].filter((record) => record.userId === userId),
    removeOutbox: async (_userId, pendingId) => { outbox.delete(pendingId); },
    updateOutbox: async (_userId, pendingId, patch) => { const record = outbox.get(pendingId); if (record) outbox.set(pendingId, { ...record, ...patch }); },
    clearUser: async (userId) => { ledgers.delete(userId); for (const record of outbox.values()) if (record.userId === userId) outbox.delete(record.id); },
  };
}

describe("offline storage", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("11111111-1111-4111-8111-111111111111") });
    setOfflineStorageAdapterForTests(adapter());
  });

  it("uses the versioned private database and keeps ledger/outbox data per user", async () => {
    expect(OFFLINE_DATABASE_NAME).toBe("mis-finanzas-offline");
    expect(OFFLINE_DATABASE_VERSION).toBe(1);
    await writeLedgerCache("user-a", ledger, "2026-09-09T00:00:00.000Z");
    const pending = await enqueueTransaction("user-a", { operationType: "expense", sourceAccountId: "cash-1", destinationAccountId: null, amount: 1, occurredOn: "2026-09-09" });

    expect(pending.draft.clientOperationId).toBe("11111111-1111-4111-8111-111111111111");
    expect((await listPendingTransactions("user-a")).map((record) => record.id)).toEqual([pending.id]);

    expect(await readLedgerCache("user-b")).toBeNull();
    expect(await listPendingTransactions("user-b")).toEqual([]);
    await clearUserData("user-a");
    expect(await readLedgerCache("user-a")).toBeNull();
    expect(await listPendingTransactions("user-a")).toEqual([]);
  });

  it("fails writes with a typed result when IndexedDB is unavailable", async () => {
    resetOfflineStorageAdapterForTests();
    vi.stubGlobal("indexedDB", undefined);
    await expect(writeLedgerCache("user-a", ledger, "2026-09-09T00:00:00.000Z")).rejects.toBeInstanceOf(OfflineStorageUnavailableError);
    await expect(readLedgerCache("user-a")).resolves.toBeNull();
  });

  it("normalizes adapter open, read, and write failures without exposing browser errors", async () => {
    const failingAdapter = adapter();
    failingAdapter.readLedger = vi.fn().mockRejectedValue(new DOMException("blocked", "SecurityError"));
    failingAdapter.writeLedger = vi.fn().mockRejectedValue(new DOMException("quota", "QuotaExceededError"));
    setOfflineStorageAdapterForTests(failingAdapter);

    await expect(readLedgerCache("user-a")).resolves.toBeNull();
    await expect(writeLedgerCache("user-a", ledger, "2026-09-09T00:00:00.000Z")).rejects.toBeInstanceOf(OfflineStorageUnavailableError);
  });
});
