import type { PersonalLedger, PersonalTransactionDraft } from "@/lib/finance/types";
import type { PendingTransaction } from "@/lib/offline/sync";

export const OFFLINE_DATABASE_NAME = "mis-finanzas-offline";
export const OFFLINE_DATABASE_VERSION = 1;

type LedgerRecord = { userId: string; ledger: PersonalLedger; updatedAt: string };

export type OfflineStorageAdapter = {
  readLedger: (userId: string) => Promise<LedgerRecord | null>;
  writeLedger: (record: LedgerRecord) => Promise<void>;
  addOutbox: (record: PendingTransaction) => Promise<void>;
  listOutbox: (userId: string) => Promise<PendingTransaction[]>;
  removeOutbox: (userId: string, pendingId: string) => Promise<void>;
  updateOutbox: (userId: string, pendingId: string, patch: Pick<PendingTransaction, "attempts" | "status" | "lastError">) => Promise<void>;
  clearUser: (userId: string) => Promise<void>;
};

export class OfflineStorageUnavailableError extends Error {
  constructor() {
    super("El almacenamiento sin conexiÃ³n no estÃ¡ disponible en este navegador.");
    this.name = "OfflineStorageUnavailableError";
  }
}

let adapterForTests: OfflineStorageAdapter | null = null;

function assertUserId(userId: string): void {
  if (!userId.trim()) throw new Error("A user ID is required for offline financial storage.");
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new OfflineStorageUnavailableError());
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = transaction.onerror = () => reject(transaction.error ?? new OfflineStorageUnavailableError());
  });
}

async function openDatabase(): Promise<IDBDatabase> {
  const indexedDb = globalThis.indexedDB;
  if (!indexedDb) throw new OfflineStorageUnavailableError();

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(OFFLINE_DATABASE_NAME, OFFLINE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("ledger")) database.createObjectStore("ledger", { keyPath: "userId" });
      if (!database.objectStoreNames.contains("outbox")) {
        const outbox = database.createObjectStore("outbox", { keyPath: "id" });
        outbox.createIndex("userId", "userId", { unique: false });
        outbox.createIndex("createdAt", "createdAt", { unique: false });
        outbox.createIndex("status", "status", { unique: false });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new OfflineStorageUnavailableError());
  });
}

const indexedDbAdapter: OfflineStorageAdapter = {
  async readLedger(userId) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("ledger", "readonly");
      const result = await requestResult(transaction.objectStore("ledger").get(userId));
      await transactionDone(transaction);
      return (result as LedgerRecord | undefined) ?? null;
    } finally {
      database.close();
    }
  },
  async writeLedger(record) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("ledger", "readwrite");
      transaction.objectStore("ledger").put(record);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
  async addOutbox(record) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("outbox", "readwrite");
      transaction.objectStore("outbox").put(record);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
  async listOutbox(userId) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("outbox", "readonly");
      const result = await requestResult(transaction.objectStore("outbox").index("userId").getAll(userId));
      await transactionDone(transaction);
      return result as PendingTransaction[];
    } finally {
      database.close();
    }
  },
  async removeOutbox(userId, pendingId) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("outbox", "readwrite");
      const outbox = transaction.objectStore("outbox");
      const record = await requestResult(outbox.get(pendingId)) as PendingTransaction | undefined;
      if (record?.userId === userId) outbox.delete(pendingId);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
  async updateOutbox(userId, pendingId, patch) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("outbox", "readwrite");
      const store = transaction.objectStore("outbox");
      const record = await requestResult(store.get(pendingId)) as PendingTransaction | undefined;
      if (record?.userId === userId) store.put({ ...record, ...patch });
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
  async clearUser(userId) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction(["ledger", "outbox"], "readwrite");
      transaction.objectStore("ledger").delete(userId);
      const outbox = transaction.objectStore("outbox");
      const records = await requestResult(outbox.index("userId").getAll(userId)) as PendingTransaction[];
      records.forEach((record) => outbox.delete(record.id));
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
};

function getAdapter(): OfflineStorageAdapter | null {
  if (adapterForTests) return adapterForTests;
  return globalThis.indexedDB ? indexedDbAdapter : null;
}

function requireAdapter(): OfflineStorageAdapter {
  const adapter = getAdapter();
  if (!adapter) throw new OfflineStorageUnavailableError();
  return adapter;
}

function stableId(): string {
  if (!globalThis.crypto?.randomUUID) throw new OfflineStorageUnavailableError();
  return globalThis.crypto.randomUUID();
}

export async function readLedgerCache(userId: string): Promise<{ ledger: PersonalLedger; updatedAt: string } | null> {
  assertUserId(userId);
  const adapter = getAdapter();
  if (!adapter) return null;
  const record = await adapter.readLedger(userId);
  return record?.userId === userId ? { ledger: record.ledger, updatedAt: record.updatedAt } : null;
}

export async function writeLedgerCache(userId: string, ledger: PersonalLedger, updatedAt: string): Promise<void> {
  assertUserId(userId);
  await requireAdapter().writeLedger({ userId, ledger, updatedAt });
}

export async function enqueueTransaction(userId: string, draft: PersonalTransactionDraft): Promise<PendingTransaction> {
  assertUserId(userId);
  const clientOperationId = draft.clientOperationId ?? stableId();
  const record: PendingTransaction = {
    id: stableId(),
    userId,
    draft: { ...draft, clientOperationId },
    createdAt: new Date().toISOString(),
    attempts: 0,
    status: "pending",
    lastError: null,
  };
  await requireAdapter().addOutbox(record);
  return record;
}

export async function listPendingTransactions(userId: string): Promise<PendingTransaction[]> {
  assertUserId(userId);
  const adapter = getAdapter();
  if (!adapter) return [];
  return (await adapter.listOutbox(userId))
    .filter((record) => record.userId === userId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
}

export async function removePendingTransaction(userId: string, pendingId: string): Promise<void> {
  assertUserId(userId);
  await requireAdapter().removeOutbox(userId, pendingId);
}

export async function updatePendingTransaction(userId: string, pendingId: string, patch: Pick<PendingTransaction, "attempts" | "status" | "lastError">): Promise<void> {
  assertUserId(userId);
  await requireAdapter().updateOutbox(userId, pendingId, patch);
}

export async function clearUserData(userId: string): Promise<void> {
  assertUserId(userId);
  await requireAdapter().clearUser(userId);
}

export function setOfflineStorageAdapterForTests(adapter: OfflineStorageAdapter): void {
  adapterForTests = adapter;
}

export function resetOfflineStorageAdapterForTests(): void {
  adapterForTests = null;
}
