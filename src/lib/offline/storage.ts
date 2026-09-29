import type { PersonalLedger, PersonalTransactionDraft } from "@/lib/finance/types";
import type { PersonalBenefit } from "@/lib/benefits/types";
import type { PendingTransaction } from "@/lib/offline/sync";

export const OFFLINE_DATABASE_NAME = "mis-finanzas-offline";
export const OFFLINE_DATABASE_VERSION = 3;

type LedgerRecord = { userId: string; ledger: PersonalLedger; updatedAt: string };
export type BenefitsRecord = { userId: string; benefits: PersonalBenefit[]; periodStart: string; updatedAt: string };

export type OfflineStorageAdapter = {
  readLedger: (userId: string) => Promise<LedgerRecord | null>;
  writeLedger: (record: LedgerRecord) => Promise<void>;
  readBenefits: (userId: string, periodStart: string) => Promise<BenefitsRecord | null>;
  writeBenefits: (record: BenefitsRecord) => Promise<void>;
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

function isCompositeBenefitsKeyPath(keyPath: string | string[] | null): boolean {
  return Array.isArray(keyPath)
    && keyPath.length === 2
    && keyPath[0] === "userId"
    && keyPath[1] === "periodStart";
}

function createBenefitsStore(database: IDBDatabase): IDBObjectStore {
  const benefits = database.createObjectStore("benefits", { keyPath: ["userId", "periodStart"] });
  benefits.createIndex("userId", "userId", { unique: false });
  return benefits;
}

function migrateBenefitsStore(database: IDBDatabase, request: IDBOpenDBRequest): void {
  const upgradeTransaction = request.transaction;
  if (!upgradeTransaction) throw new Error("The offline database upgrade transaction is unavailable.");

  const legacyBenefits = upgradeTransaction.objectStore("benefits");
  if (isCompositeBenefitsKeyPath(legacyBenefits.keyPath)) {
    if (!legacyBenefits.indexNames.contains("userId")) legacyBenefits.createIndex("userId", "userId", { unique: false });
    return;
  }

  const legacyRecordsRequest = legacyBenefits.getAll();
  legacyRecordsRequest.onsuccess = () => {
    const records = legacyRecordsRequest.result as BenefitsRecord[];
    database.deleteObjectStore("benefits");
    const benefits = createBenefitsStore(database);
    records.forEach((record) => {
      if (record && typeof record.userId === "string" && typeof record.periodStart === "string") benefits.put(record);
    });
  };
}

async function openDatabase(): Promise<IDBDatabase> {
  const indexedDb = globalThis.indexedDB;
  if (!indexedDb) throw new OfflineStorageUnavailableError();

  return new Promise((resolve, reject) => {
    const request = indexedDb.open(OFFLINE_DATABASE_NAME, OFFLINE_DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains("ledger")) database.createObjectStore("ledger", { keyPath: "userId" });
      if (!database.objectStoreNames.contains("benefits")) createBenefitsStore(database);
      else migrateBenefitsStore(database, request);
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
  async readBenefits(userId, periodStart) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("benefits", "readonly");
      const result = await requestResult(transaction.objectStore("benefits").get([userId, periodStart]));
      await transactionDone(transaction);
      return (result as BenefitsRecord | undefined) ?? null;
    } finally {
      database.close();
    }
  },
  async writeBenefits(record) {
    const database = await openDatabase();
    try {
      const transaction = database.transaction("benefits", "readwrite");
      transaction.objectStore("benefits").put(record);
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
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
      const transaction = database.transaction(["ledger", "outbox", "benefits"], "readwrite");
      transaction.objectStore("ledger").delete(userId);
      const benefits = transaction.objectStore("benefits");
      const outbox = transaction.objectStore("outbox");
      const [benefitKeys, records] = await Promise.all([
        requestResult(benefits.index("userId").getAllKeys(userId)),
        requestResult(outbox.index("userId").getAll(userId)) as Promise<PendingTransaction[]>,
      ]);
      benefitKeys.forEach((key) => benefits.delete(key));
      records.forEach((record) => outbox.delete(record.id));
      await transactionDone(transaction);
    } finally {
      database.close();
    }
  },
};

function getAdapter(): OfflineStorageAdapter | null {
  try {
    if (adapterForTests) return adapterForTests;
    return globalThis.indexedDB ? indexedDbAdapter : null;
  } catch {
    return null;
  }
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

function unavailable(error: unknown): OfflineStorageUnavailableError {
  return error instanceof OfflineStorageUnavailableError ? error : new OfflineStorageUnavailableError();
}

export async function readLedgerCache(userId: string): Promise<{ ledger: PersonalLedger; updatedAt: string } | null> {
  assertUserId(userId);
  try {
    const adapter = getAdapter();
    if (!adapter) return null;
    const record = await adapter.readLedger(userId);
    return record?.userId === userId ? { ledger: record.ledger, updatedAt: record.updatedAt } : null;
  } catch {
    return null;
  }
}

export async function writeLedgerCache(userId: string, ledger: PersonalLedger, updatedAt: string): Promise<void> {
  assertUserId(userId);
  try {
    await requireAdapter().writeLedger({ userId, ledger, updatedAt });
  } catch (error) {
    throw unavailable(error);
  }
}

export async function readBenefitsCache(userId: string, periodStart: string): Promise<Omit<BenefitsRecord, "userId"> | null> {
  assertUserId(userId);
  try {
    const record = await requireAdapter().readBenefits(userId, periodStart);
    return record?.userId === userId && record.periodStart === periodStart
      ? { benefits: record.benefits, periodStart: record.periodStart, updatedAt: record.updatedAt }
      : null;
  } catch (error) {
    throw unavailable(error);
  }
}

export async function writeBenefitsCache(userId: string, benefits: PersonalBenefit[], periodStart: string, updatedAt: string): Promise<void> {
  assertUserId(userId);
  try {
    await requireAdapter().writeBenefits({ userId, benefits, periodStart, updatedAt });
  } catch (error) {
    throw unavailable(error);
  }
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
  try {
    await requireAdapter().addOutbox(record);
  } catch (error) {
    throw unavailable(error);
  }
  return record;
}

export async function listPendingTransactions(userId: string): Promise<PendingTransaction[]> {
  assertUserId(userId);
  try {
    const adapter = getAdapter();
    if (!adapter) return [];
    return (await adapter.listOutbox(userId))
      .filter((record) => record.userId === userId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  } catch {
    return [];
  }
}

export async function removePendingTransaction(userId: string, pendingId: string): Promise<void> {
  assertUserId(userId);
  try {
    await requireAdapter().removeOutbox(userId, pendingId);
  } catch (error) {
    throw unavailable(error);
  }
}

export async function updatePendingTransaction(userId: string, pendingId: string, patch: Pick<PendingTransaction, "attempts" | "status" | "lastError">): Promise<void> {
  assertUserId(userId);
  try {
    await requireAdapter().updateOutbox(userId, pendingId, patch);
  } catch (error) {
    throw unavailable(error);
  }
}

export async function clearUserData(userId: string): Promise<void> {
  assertUserId(userId);
  try {
    await requireAdapter().clearUser(userId);
  } catch (error) {
    throw unavailable(error);
  }
}

export function setOfflineStorageAdapterForTests(adapter: OfflineStorageAdapter): void {
  adapterForTests = adapter;
}

export function resetOfflineStorageAdapterForTests(): void {
  adapterForTests = null;
}
