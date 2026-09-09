"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { applyPendingTransaction } from "@/lib/finance/local-ledger";
import { loadPersonalLedger, normalizePurchaseItems, recordPersonalTransaction, validateOperationAccounts } from "@/lib/finance/personal-ledger";
import {
  OfflineStorageUnavailableError,
  enqueueTransaction,
  listPendingTransactions,
  readLedgerCache,
  removePendingTransaction,
  updatePendingTransaction,
  writeLedgerCache,
} from "@/lib/offline/storage";
import { isRetryableSyncError, syncPendingTransactions, type PendingTransaction } from "@/lib/offline/sync";
import type { PersonalAccount, PersonalLedger, PersonalTransactionDraft } from "@/lib/finance/types";

export type PersonalFinanceContextValue = {
  ledger: PersonalLedger;
  freshness: "server" | "cached" | "offline";
  lastUpdatedAt: string | null;
  pendingCount: number;
  isSyncing: boolean;
  storageWarning: boolean;
  refresh: () => Promise<void>;
  recordTransaction: (draft: PersonalTransactionDraft, accounts: PersonalAccount[]) => Promise<void>;
};

type PersonalFinanceProviderProps = {
  userId: string;
  initialLedger: PersonalLedger;
  initialLedgerUpdatedAt: string | null;
  children: ReactNode;
};

type MemorySnapshot = { ledger: PersonalLedger; updatedAt: string };

const PersonalFinanceContext = createContext<PersonalFinanceContextValue | null>(null);
const latestLedgerByUser = typeof window === "undefined" ? null : new Map<string, MemorySnapshot>();

function online(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine !== false;
}

function createClientOperationId(): string {
  if (!globalThis.crypto?.randomUUID) throw new Error("No pudimos preparar el movimiento sin conexiÃ³n.");
  return globalThis.crypto.randomUUID();
}

function localPending(userId: string, draft: PersonalTransactionDraft & { clientOperationId: string }): PendingTransaction {
  return { id: `memory:${draft.clientOperationId}`, userId, draft, createdAt: new Date().toISOString(), attempts: 0, status: "pending", lastError: null };
}

function mergePendingTransactions(baseLedger: PersonalLedger, pending: PendingTransaction[]): PersonalLedger {
  return pending.reduce((nextLedger, operation) => {
    const next = applyPendingTransaction(nextLedger, operation.draft, operation.id);
    if (operation.status === "pending") return next;
    return {
      ...next,
      transactions: next.transactions.map((transaction) => transaction.clientOperationId === operation.draft.clientOperationId
        ? { ...transaction, syncStatus: operation.status }
        : transaction),
    };
  }, baseLedger);
}

function newerThanServer(snapshot: MemorySnapshot, initialLedgerUpdatedAt: string | null): boolean {
  return initialLedgerUpdatedAt === null || snapshot.updatedAt > initialLedgerUpdatedAt;
}

export function PersonalFinanceProvider(props: PersonalFinanceProviderProps) {
  return <PersonalFinanceProviderForUser key={props.userId} {...props} />;
}

function PersonalFinanceProviderForUser({ userId, initialLedger, initialLedgerUpdatedAt, children }: PersonalFinanceProviderProps) {
  const memorySnapshot = latestLedgerByUser?.get(userId) ?? null;
  const initialSnapshot = memorySnapshot && newerThanServer(memorySnapshot, initialLedgerUpdatedAt)
    ? memorySnapshot
    : { ledger: initialLedger, updatedAt: initialLedgerUpdatedAt };
  const baseLedgerRef = useRef(initialSnapshot.ledger);
  const pendingRef = useRef<PendingTransaction[]>([]);
  const serverSnapshotUpdatedAtRef = useRef(initialLedgerUpdatedAt);
  const snapshotGenerationRef = useRef(0);
  const syncPromiseRef = useRef<Promise<void> | null>(null);
  const [ledger, setLedger] = useState(() => initialSnapshot.ledger);
  const [freshness, setFreshness] = useState<PersonalFinanceContextValue["freshness"]>(() => initialSnapshot === memorySnapshot ? "cached" : initialLedgerUpdatedAt === null ? "offline" : "server");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(initialSnapshot.updatedAt);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageWarning, setStorageWarning] = useState(false);

  const showStorageWarning = useCallback((error: unknown) => {
    if (error instanceof OfflineStorageUnavailableError) setStorageWarning(true);
  }, []);

  const renderPending = useCallback((baseLedger: PersonalLedger, pending = pendingRef.current) => {
    setLedger(mergePendingTransactions(baseLedger, pending));
  }, []);

  const setPending = useCallback((nextPending: PendingTransaction[]) => {
    pendingRef.current = nextPending;
    renderPending(baseLedgerRef.current, nextPending);
  }, [renderPending]);

  const refresh = useCallback(async () => {
    const refreshGeneration = snapshotGenerationRef.current;
    setIsSyncing(true);
    try {
      const nextLedger = await loadPersonalLedger();
      if (snapshotGenerationRef.current !== refreshGeneration) return;
      const updatedAt = new Date().toISOString();
      baseLedgerRef.current = nextLedger;
      latestLedgerByUser?.set(userId, { ledger: nextLedger, updatedAt });
      renderPending(nextLedger);
      setFreshness("server");
      setLastUpdatedAt(updatedAt);
      try {
        await writeLedgerCache(userId, nextLedger, updatedAt);
      } catch (error) {
        showStorageWarning(error);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [renderPending, showStorageWarning, userId]);

  const synchronize = useCallback((): Promise<void> => {
    if (syncPromiseRef.current) return syncPromiseRef.current;

    const sync = (async () => {
      setIsSyncing(true);
      try {
        const result = await syncPendingTransactions(userId, {
          list: async () => pendingRef.current,
          send: (draft) => recordPersonalTransaction(draft, baseLedgerRef.current.accounts),
          remove: async (operationUserId, pendingId) => {
            try {
              await removePendingTransaction(operationUserId, pendingId);
            } catch (error) {
              showStorageWarning(error);
            }
            setPending(pendingRef.current.filter((operation) => operation.id !== pendingId));
          },
          update: async (operationUserId, pendingId, patch) => {
            try {
              await updatePendingTransaction(operationUserId, pendingId, patch);
            } catch (error) {
              showStorageWarning(error);
            }
            setPending(pendingRef.current.map((operation) => operation.id === pendingId ? { ...operation, ...patch } : operation));
          },
        });
        if (result.syncedCount > 0) {
          try {
            await refresh();
          } catch {
            setFreshness("offline");
          }
        }
      } finally {
        setIsSyncing(false);
      }
    })();
    syncPromiseRef.current = sync;
    void sync.then(
      () => { if (syncPromiseRef.current === sync) syncPromiseRef.current = null; },
      () => { if (syncPromiseRef.current === sync) syncPromiseRef.current = null; },
    );
    return sync;
  }, [refresh, setPending, showStorageWarning, userId]);

  const queueTransaction = useCallback(async (draft: PersonalTransactionDraft & { clientOperationId: string }) => {
    let operation: PendingTransaction;
    try {
      operation = await enqueueTransaction(userId, draft);
    } catch (error) {
      showStorageWarning(error);
      operation = localPending(userId, draft);
    }
    setPending([...pendingRef.current, operation]);
  }, [setPending, showStorageWarning, userId]);

  const recordTransaction = useCallback(async (draft: PersonalTransactionDraft, accounts: PersonalAccount[]) => {
    const validationError = validateOperationAccounts(draft.operationType, draft.sourceAccountId, draft.destinationAccountId, accounts);
    if (validationError) throw new Error(validationError);
    if (!Number.isFinite(draft.amount) || draft.amount <= 0 || !draft.occurredOn) {
      throw new Error("No pudimos guardar la operaciÃ³n. RevisÃ¡ los datos e intentÃ¡ de nuevo.");
    }
    normalizePurchaseItems(draft.items ?? []);
    const draftWithOperationId = { ...draft, clientOperationId: draft.clientOperationId ?? createClientOperationId() };

    if (!online()) {
      await queueTransaction(draftWithOperationId);
      setFreshness("offline");
      return;
    }

    try {
      await recordPersonalTransaction(draftWithOperationId, accounts);
    } catch (error) {
      if (!isRetryableSyncError(error)) throw error;
      await queueTransaction(draftWithOperationId);
      setFreshness("offline");
      return;
    }

    await synchronize();
    try {
      await refresh();
    } catch {
      setFreshness("offline");
    }
  }, [queueTransaction, refresh, synchronize]);

  useEffect(() => {
    if (initialLedgerUpdatedAt === null) return;
    const previousServerSnapshotUpdatedAt = serverSnapshotUpdatedAtRef.current;
    if (previousServerSnapshotUpdatedAt !== null && initialLedgerUpdatedAt <= previousServerSnapshotUpdatedAt) return;
    serverSnapshotUpdatedAtRef.current = initialLedgerUpdatedAt;
    snapshotGenerationRef.current += 1;

    const newerMemorySnapshot = latestLedgerByUser?.get(userId);
    if (newerMemorySnapshot && newerMemorySnapshot.updatedAt > initialLedgerUpdatedAt) return;

    baseLedgerRef.current = initialLedger;
    latestLedgerByUser?.set(userId, { ledger: initialLedger, updatedAt: initialLedgerUpdatedAt });
    renderPending(initialLedger);
    setFreshness("server");
    setLastUpdatedAt(initialLedgerUpdatedAt);
  }, [initialLedger, initialLedgerUpdatedAt, renderPending, userId]);

  useEffect(() => {
    let active = true;
    const hydrate = async () => {
      const [cache, storedPending] = await Promise.all([readLedgerCache(userId), listPendingTransactions(userId)]);
      if (!active) return;
      const mergedPending = [...pendingRef.current, ...storedPending.filter((stored) => !pendingRef.current.some((current) => current.id === stored.id))];
      pendingRef.current = mergedPending;
      if (cache && newerThanServer(cache, initialLedgerUpdatedAt)) {
        baseLedgerRef.current = cache.ledger;
        latestLedgerByUser?.set(userId, { ledger: cache.ledger, updatedAt: cache.updatedAt });
        setFreshness("cached");
        setLastUpdatedAt(cache.updatedAt);
        renderPending(cache.ledger, mergedPending);
      } else {
        renderPending(baseLedgerRef.current, mergedPending);
        if (initialLedgerUpdatedAt !== null) {
          try {
            await writeLedgerCache(userId, baseLedgerRef.current, initialLedgerUpdatedAt);
          } catch (error) {
            showStorageWarning(error);
          }
        }
      }
    };
    const onOnline = () => { void synchronize(); };
    const onOffline = () => setFreshness("offline");
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") void synchronize();
    };

    void hydrate().finally(() => {
      if (!active) return;
      if (online()) {
        void refresh().catch(() => {
          if (active) setFreshness("offline");
        });
      }
      void synchronize();
    });
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [initialLedgerUpdatedAt, refresh, renderPending, showStorageWarning, synchronize, userId]);

  const value = useMemo<PersonalFinanceContextValue>(() => ({
    ledger,
    freshness,
    lastUpdatedAt,
    pendingCount: pendingRef.current.length,
    isSyncing,
    storageWarning,
    refresh,
    recordTransaction,
  }), [freshness, isSyncing, lastUpdatedAt, ledger, recordTransaction, refresh, storageWarning]);

  return <PersonalFinanceContext.Provider value={value}>
    {children}
    {storageWarning ? <p aria-live="polite" className="sr-only">El almacenamiento sin conexiÃ³n no estÃ¡ disponible; el movimiento se conservarÃ¡ mientras esta pestaÃ±a siga abierta.</p> : null}
  </PersonalFinanceContext.Provider>;
}

export function usePersonalFinance(): PersonalFinanceContextValue {
  const value = useContext(PersonalFinanceContext);
  if (!value) throw new Error("usePersonalFinance must be used within PersonalFinanceProvider.");
  return value;
}

export function useOptionalPersonalFinance(): PersonalFinanceContextValue | null {
  return useContext(PersonalFinanceContext);
}
