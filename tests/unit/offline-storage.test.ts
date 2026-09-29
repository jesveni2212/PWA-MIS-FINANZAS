import { createElement, useEffect } from "react";
import { act, cleanup, render, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersonalBenefitsProvider, usePersonalBenefits, type PersonalBenefitsContextValue, type PersonalBenefitsProviderProps } from "@/components/benefits/personal-benefits-provider";
import { PersonalBenefitsLoadError, personalBenefitsLoadError } from "@/lib/benefits/benefit-payload";
import { personalBenefitSaveError } from "@/lib/benefits/repository";
import type { PersonalBenefit } from "@/lib/benefits/types";

import {
  OFFLINE_DATABASE_NAME,
  OFFLINE_DATABASE_VERSION,
  OfflineStorageUnavailableError,
  clearUserData,
  enqueueTransaction,
  listPendingTransactions,
  readLedgerCache,
  readBenefitsCache,
  resetOfflineStorageAdapterForTests,
  setOfflineStorageAdapterForTests,
  writeLedgerCache,
  writeBenefitsCache,
  type BenefitsRecord,
  type OfflineStorageAdapter,
} from "@/lib/offline/storage";
import type { PersonalLedger } from "@/lib/finance/types";

const ledger: PersonalLedger = { accounts: [], transactions: [] };

const repository = vi.hoisted(() => ({
  loadPersonalBenefits: vi.fn(), createPersonalBenefit: vi.fn(), updatePersonalBenefit: vi.fn(),
  duplicatePersonalBenefit: vi.fn(), disablePersonalBenefit: vi.fn(),
}));
const finance = vi.hoisted(() => ({ context: null as { ledger: PersonalLedger; syncRevision?: number } | null }));
vi.mock("@/lib/benefits/repository", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/benefits/repository")>(), ...repository,
}));
vi.mock("@/components/finance/personal-finance-provider", () => ({
  useOptionalPersonalFinance: () => finance.context,
}));

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  resetOfflineStorageAdapterForTests();
  vi.unstubAllGlobals();
  finance.context = null;
});

function adapter(): OfflineStorageAdapter & { version: number } {
  const ledgers = new Map<string, { userId: string; ledger: PersonalLedger; updatedAt: string }>();
  const outbox = new Map<string, Awaited<ReturnType<typeof enqueueTransaction>>>();
  const benefits = new Map<string, BenefitsRecord>();
  const benefitKey = (userId: string, periodStart: string) => `${userId}\u0000${periodStart}`;
  return {
    version: OFFLINE_DATABASE_VERSION,
    readLedger: async (userId) => ledgers.get(userId) ?? null,
    writeLedger: async (record) => { ledgers.set(record.userId, record); },
    readBenefits: async (userId, periodStart) => benefits.get(benefitKey(userId, periodStart)) ?? null,
    writeBenefits: async (record) => { benefits.set(benefitKey(record.userId, record.periodStart), record); },
    addOutbox: async (record) => { outbox.set(record.id, record); },
    listOutbox: async (userId) => [...outbox.values()].filter((record) => record.userId === userId),
    removeOutbox: async (_userId, pendingId) => { outbox.delete(pendingId); },
    updateOutbox: async (_userId, pendingId, patch) => { const record = outbox.get(pendingId); if (record) outbox.set(pendingId, { ...record, ...patch }); },
    clearUser: async (userId) => {
      ledgers.delete(userId);
      for (const [key, record] of benefits) if (record.userId === userId) benefits.delete(key);
      for (const record of outbox.values()) if (record.userId === userId) outbox.delete(record.id);
    },
  };
}

describe("offline storage", () => {
  beforeEach(() => {
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("11111111-1111-4111-8111-111111111111") });
    setOfflineStorageAdapterForTests(adapter());
  });

  it("uses the versioned private database and keeps ledger/outbox data per user", async () => {
    expect(OFFLINE_DATABASE_NAME).toBe("mis-finanzas-offline");
    expect(OFFLINE_DATABASE_VERSION).toBe(3);
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

  it("keeps benefit snapshots scoped to user and period and clears only the requested user", async () => {
    const updatedAt = "2026-09-29T00:00:00.000Z";
    await writeBenefitsCache("user-a", [], "2026-09-01", updatedAt);
    await writeBenefitsCache("user-a", [], "2026-10-01", updatedAt);
    expect(await readBenefitsCache("user-a", "2026-09-01")).toEqual({ benefits: [], periodStart: "2026-09-01", updatedAt });
    expect(await readBenefitsCache("user-a", "2026-10-01")).toEqual({ benefits: [], periodStart: "2026-10-01", updatedAt });
    expect(await readBenefitsCache("user-b", "2026-09-01")).toBeNull();
    await writeBenefitsCache("user-b", [], "2026-09-01", updatedAt);
    await clearUserData("user-a");
    expect(await readBenefitsCache("user-a", "2026-09-01")).toBeNull();
    expect(await readBenefitsCache("user-a", "2026-10-01")).toBeNull();
    expect(await readBenefitsCache("user-b", "2026-09-01")).not.toBeNull();
  });

  it("does not return another user's benefit data even from a faulty adapter", async () => {
    const faulty = adapter();
    faulty.readBenefits = async () => ({ userId: "user-b", benefits: [], periodStart: "2026-09-01", updatedAt: "now" });
    setOfflineStorageAdapterForTests(faulty);
    expect(await readBenefitsCache("user-a", "2026-09-01")).toBeNull();
  });

  it("normalizes benefit cache failures to the typed unavailable error without blocking outbox writes", async () => {
    const failing = adapter();
    failing.readBenefits = vi.fn().mockRejectedValue(new DOMException("private read", "SecurityError"));
    failing.writeBenefits = vi.fn().mockRejectedValue(new DOMException("private quota", "QuotaExceededError"));
    setOfflineStorageAdapterForTests(failing);
    await expect(readBenefitsCache("user-a", "2026-09-01")).rejects.toBeInstanceOf(OfflineStorageUnavailableError);
    await expect(writeBenefitsCache("user-a", [], "2026-09-01", "now")).rejects.toBeInstanceOf(OfflineStorageUnavailableError);
    await expect(enqueueTransaction("user-a", { operationType: "expense", sourceAccountId: "cash-1", destinationAccountId: null, amount: 1, occurredOn: "2026-09-29" })).resolves.toHaveProperty("userId", "user-a");
    resetOfflineStorageAdapterForTests();
    vi.stubGlobal("indexedDB", undefined);
    await expect(readBenefitsCache("user-a", "2026-09-01")).rejects.toBeInstanceOf(OfflineStorageUnavailableError);
    await expect(writeBenefitsCache("user-a", [], "2026-09-01", "now")).rejects.toBeInstanceOf(OfflineStorageUnavailableError);
  });

  it("creates a composite-key benefits store during upgrade without recreating ledger/outbox", async () => {
    resetOfflineStorageAdapterForTests();
    const createObjectStore = vi.fn();
    const createIndex = vi.fn();
    const put = vi.fn();
    const benefitsStore = { createIndex, put };
    const transaction = { objectStore: () => benefitsStore, oncomplete: null as (() => void) | null };
    const database = {
      objectStoreNames: { contains: (name: string) => name === "ledger" || name === "outbox" },
      createObjectStore: createObjectStore.mockReturnValue(benefitsStore),
      transaction: vi.fn(() => { queueMicrotask(() => transaction.oncomplete?.()); return transaction; }), close: vi.fn(),
    };
    const request = { result: database, onupgradeneeded: null as (() => void) | null, onsuccess: null as (() => void) | null };
    const open = vi.fn(() => {
      queueMicrotask(() => { request.onupgradeneeded?.(); request.onsuccess?.(); });
      return request;
    });
    vi.stubGlobal("indexedDB", { open });
    await writeBenefitsCache("user-a", [], "2026-09-01", "now");
    expect(open).toHaveBeenCalledWith(OFFLINE_DATABASE_NAME, 3);
    expect(createObjectStore.mock.calls).toEqual([["benefits", { keyPath: ["userId", "periodStart"] }]]);
    expect(createIndex).toHaveBeenCalledWith("userId", "userId", { unique: false });
    expect(database.transaction).toHaveBeenCalledWith("benefits", "readwrite");
    expect(put).toHaveBeenCalledWith({ userId: "user-a", benefits: [], periodStart: "2026-09-01", updatedAt: "now" });
    expect(database.close).toHaveBeenCalled();
  });

  it("migrates the legacy user-keyed benefits snapshot without touching ledger or outbox", async () => {
    resetOfflineStorageAdapterForTests();
    const legacyRecord = { userId: "user-a", benefits: [], periodStart: "2026-09-01", updatedAt: "legacy" } satisfies BenefitsRecord;
    const createIndex = vi.fn();
    const migratedPut = vi.fn();
    const legacyGetAllRequest = { result: [legacyRecord], onsuccess: null as (() => void) | null };
    const legacyStore = {
      keyPath: "userId",
      indexNames: { contains: () => false },
      getAll: vi.fn(() => {
        queueMicrotask(() => {
          legacyGetAllRequest.onsuccess?.();
          queueMicrotask(() => request.onsuccess?.());
        });
        return legacyGetAllRequest;
      }),
    };
    const migratedStore = { createIndex, put: migratedPut };
    const upgradeTransaction = { objectStore: vi.fn(() => legacyStore) };
    const runtimeTransaction = { objectStore: vi.fn(() => migratedStore), oncomplete: null as (() => void) | null };
    const database = {
      objectStoreNames: { contains: (name: string) => ["ledger", "outbox", "benefits"].includes(name) },
      deleteObjectStore: vi.fn(),
      createObjectStore: vi.fn(() => migratedStore),
      transaction: vi.fn(() => { queueMicrotask(() => runtimeTransaction.oncomplete?.()); return runtimeTransaction; }),
      close: vi.fn(),
    };
    const request = {
      result: database,
      transaction: upgradeTransaction,
      onupgradeneeded: null as (() => void) | null,
      onsuccess: null as (() => void) | null,
    };
    const open = vi.fn(() => {
      queueMicrotask(() => request.onupgradeneeded?.());
      return request;
    });
    vi.stubGlobal("indexedDB", { open });

    await writeBenefitsCache("user-a", [], "2026-10-01", "new");

    expect(open).toHaveBeenCalledWith(OFFLINE_DATABASE_NAME, 3);
    expect(database.deleteObjectStore).toHaveBeenCalledWith("benefits");
    expect(database.deleteObjectStore).not.toHaveBeenCalledWith("ledger");
    expect(database.deleteObjectStore).not.toHaveBeenCalledWith("outbox");
    expect(database.createObjectStore).toHaveBeenCalledWith("benefits", { keyPath: ["userId", "periodStart"] });
    expect(createIndex).toHaveBeenCalledWith("userId", "userId", { unique: false });
    expect(migratedPut).toHaveBeenCalledWith(legacyRecord);
    expect(migratedPut).toHaveBeenCalledWith({ userId: "user-a", benefits: [], periodStart: "2026-10-01", updatedAt: "new" });
  });

  it("uses the user index to clear every composite benefit period for one user", async () => {
    resetOfflineStorageAdapterForTests();
    const benefitKeys = [["user-a", "2026-09-01"], ["user-a", "2026-10-01"]];
    const keysRequest = { result: benefitKeys, onsuccess: null as (() => void) | null };
    const outboxRequest = { result: [] as unknown[], onsuccess: null as (() => void) | null };
    const getAllKeys = vi.fn(() => {
      queueMicrotask(() => keysRequest.onsuccess?.());
      return keysRequest;
    });
    const getAll = vi.fn(() => {
      queueMicrotask(() => {
        outboxRequest.onsuccess?.();
        setTimeout(() => transaction.oncomplete?.(), 0);
      });
      return outboxRequest;
    });
    const ledgerDelete = vi.fn();
    const benefitsDelete = vi.fn();
    const benefitsStore = { index: vi.fn(() => ({ getAllKeys })), delete: benefitsDelete };
    const outboxStore = { index: vi.fn(() => ({ getAll })) };
    const ledgerStore = { delete: ledgerDelete };
    const transaction = {
      objectStore: vi.fn((name: string) => name === "ledger" ? ledgerStore : name === "benefits" ? benefitsStore : outboxStore),
      oncomplete: null as (() => void) | null,
      onerror: null as (() => void) | null,
      onabort: null as (() => void) | null,
      error: null,
    };
    const database = { transaction: vi.fn(() => transaction), close: vi.fn(), objectStoreNames: { contains: () => true } };
    const request = { result: database, onupgradeneeded: null as (() => void) | null, onsuccess: null as (() => void) | null };
    const open = vi.fn(() => {
      queueMicrotask(() => request.onsuccess?.());
      return request;
    });
    vi.stubGlobal("indexedDB", { open });

    await clearUserData("user-a");

    expect(database.transaction).toHaveBeenCalledWith(["ledger", "outbox", "benefits"], "readwrite");
    expect(ledgerDelete).toHaveBeenCalledWith("user-a");
    expect(benefitsStore.index).toHaveBeenCalledWith("userId");
    expect(getAllKeys).toHaveBeenCalledWith("user-a");
    expect(benefitsDelete).toHaveBeenNthCalledWith(1, ["user-a", "2026-09-01"]);
    expect(benefitsDelete).toHaveBeenNthCalledWith(2, ["user-a", "2026-10-01"]);
    expect(database.close).toHaveBeenCalled();
  });
});

const benefit: PersonalBenefit = {
  id: "benefit-1", accountId: "card-1", accountLabel: "Banco · Visa", merchantName: "Super", merchantAliases: [],
  benefitType: "rebate", rateBps: 2500, purchaseCap: 1000, rebateCap: 250, usedPurchase: 200, usedRebate: 50,
  currency: "PYG", recurrence: "monthly", weekdays: [2], validFrom: "2026-09-01", validUntil: "2026-09-30",
  channel: "all", conditions: null, sourceUrl: null, sourceCheckedAt: null, status: "active",
};

describe("benefits provider/cache boundary", () => {
  let context: PersonalBenefitsContextValue;
  function Reader() { context = usePersonalBenefits(); return null; }
  function tree(userId = "user-a", initialBenefits: PersonalBenefit[] | null = null, periodStart = "2026-09-01") {
    return createElement(PersonalBenefitsProvider, { userId, initialBenefits, periodStart } as PersonalBenefitsProviderProps, createElement(Reader));
  }
  beforeEach(() => {
    setOfflineStorageAdapterForTests(adapter());
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    Object.values(repository).forEach((mock) => mock.mockReset());
    repository.loadPersonalBenefits.mockResolvedValue([benefit]);
  });

  it("restores only the current user's current-period cache and resets on scope changes", async () => {
    await writeBenefitsCache("user-a", [benefit], "2026-09-01", "2026-09-29T00:00:00Z");
    const view = render(tree());
    await waitFor(() => expect(context.benefits).toEqual([benefit]));
    expect(context.freshness).toBe("cached");
    expect(repository.loadPersonalBenefits).not.toHaveBeenCalled();
    view.rerender(tree("user-b"));
    expect(context.benefits).toEqual([]);
    view.rerender(tree("user-a", null, "2026-10-01"));
    await act(async () => undefined);
    expect(context.benefits).toEqual([]);
  });

  it("refreshes after all mutations and computes previews without repository writes", async () => {
    render(tree("user-a", [benefit]));
    await act(async () => undefined);
    await act(async () => {
      await context.createBenefit(benefit);
      await context.updateBenefit("benefit-1", benefit);
      await context.duplicateBenefit("benefit-1", "2026-10-01", "2026-10-31");
      await context.disableBenefit("benefit-1");
    });
    expect(repository.loadPersonalBenefits).toHaveBeenCalledTimes(4);
    expect(repository.duplicatePersonalBenefit).toHaveBeenCalledWith("benefit-1", "2026-10-01", "2026-10-31", "monthly");
    expect(repository.loadPersonalBenefits).toHaveBeenLastCalledWith("2026-09-01");
    const calls = Object.values(repository).map((mock) => mock.mock.calls.length);
    expect(context.preview({ accountId: "card-1", merchant: "Super", amount: 100, occurredOn: "2026-09-29", currency: "PYG" }))
      .toEqual({ eligiblePurchase: 100, estimatedRebate: 25, purchaseRemaining: 700, rebateRemaining: 175 });
    expect(Object.values(repository).map((mock) => mock.mock.calls.length)).toEqual(calls);
    expect((await readBenefitsCache("user-a", "2026-09-01"))?.benefits).toEqual([benefit]);
  });

  it("projects pending card purchases into previews without creating local applications", async () => {
    finance.context = {
      ledger: {
        accounts: [],
        transactions: [{
          id: "pending:purchase-1",
          clientOperationId: "purchase-1",
          syncStatus: "pending",
          operationType: "card_purchase",
          sourceAccountId: "card-1",
          destinationAccountId: null,
          amount: 300,
          currency: "PYG",
          occurredOn: "2026-09-15",
          category: "Comida",
          note: null,
          merchant: "Super",
          items: [],
        }],
      },
    };
    render(tree("user-a", [benefit]));
    await act(async () => undefined);

    const input = { accountId: "card-1", merchant: "Super", amount: 100, occurredOn: "2026-09-15", currency: "PYG" };
    expect(context.previewBenefit(input)).toMatchObject({ usedPurchase: 500, usedRebate: 125 });
    expect(context.preview(input)).toEqual({ eligiblePurchase: 100, estimatedRebate: 25, purchaseRemaining: 400, rebateRemaining: 100 });
    expect(repository.createPersonalBenefit).not.toHaveBeenCalled();
    expect(repository.updatePersonalBenefit).not.toHaveBeenCalled();
    expect(repository.duplicatePersonalBenefit).not.toHaveBeenCalled();
    expect(repository.disablePersonalBenefit).not.toHaveBeenCalled();
  });

  it("refreshes once after the finance provider reports a completed outbox sync", async () => {
    finance.context = { ledger, syncRevision: 0 };
    const view = render(tree("user-a", [benefit]));
    await act(async () => undefined);
    repository.loadPersonalBenefits.mockClear();
    repository.loadPersonalBenefits.mockResolvedValue([{ ...benefit, usedPurchase: 500, usedRebate: 125 }]);

    finance.context = { ledger, syncRevision: 1 };
    view.rerender(tree("user-a", [benefit]));
    await waitFor(() => expect(repository.loadPersonalBenefits).toHaveBeenCalledTimes(1));
    expect(repository.loadPersonalBenefits).toHaveBeenCalledWith("2026-09-01");

    view.rerender(tree("user-a", [benefit]));
    await act(async () => undefined);
    expect(repository.loadPersonalBenefits).toHaveBeenCalledTimes(1);
  });

  it("keeps weekly snapshots readable but rejects duplication before the repository", async () => {
    const weekly = { ...benefit, recurrence: "weekly" as const };
    render(tree("user-a", [weekly]));
    await act(async () => undefined);
    expect(context.benefits).toEqual([weekly]);
    await expect(context.duplicateBenefit(weekly.id, "2026-10-01", "2026-10-31")).rejects.toThrow(personalBenefitSaveError);
    await expect(context.duplicateBenefit("missing", "2026-10-01", "2026-10-31")).rejects.toThrow(personalBenefitSaveError);
    expect(repository.duplicatePersonalBenefit).not.toHaveBeenCalled();
    expect(repository.loadPersonalBenefits).not.toHaveBeenCalled();
  });

  it.each(["online", "visibilitychange"])("loads the new automatic month on %s without remounting", async (event) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59));
    const mounts = vi.fn();
    function MountedReader() {
      useEffect(() => { mounts(); }, []);
      return createElement(Reader);
    }
    render(createElement(PersonalBenefitsProvider, { userId: "user-a", initialBenefits: [benefit] } as PersonalBenefitsProviderProps, createElement(MountedReader)));
    await act(async () => undefined);
    expect(context.benefits).toEqual([benefit]);
    expect((await readBenefitsCache("user-a", "2026-09-01"))?.benefits).toEqual([benefit]);
    // Start a September load that must not overwrite the resumed October load.
    let resolveOld!: (value: PersonalBenefit[]) => void;
    repository.loadPersonalBenefits.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    let oldRefresh!: Promise<void>;
    await act(async () => { oldRefresh = context.refresh(); });
    expect(repository.loadPersonalBenefits).toHaveBeenLastCalledWith("2026-09-01");
    const october = { ...benefit, id: "october", validFrom: "2026-10-01", validUntil: "2026-10-31" };
    repository.loadPersonalBenefits.mockResolvedValue([october]);
    vi.setSystemTime(new Date(2026, 9, 1, 0, 1));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => {
      (event === "online" ? window : document).dispatchEvent(new Event(event));
    });
    expect(repository.loadPersonalBenefits).toHaveBeenLastCalledWith("2026-10-01");
    await act(async () => { resolveOld([benefit]); await oldRefresh; });
    expect(context.benefits).toEqual([october]);
    expect((await readBenefitsCache("user-a", "2026-10-01"))?.benefits).toEqual([october]);
    expect((await readBenefitsCache("user-a", "2026-09-01"))?.benefits).toEqual([benefit]);
    await act(async () => { await context.refresh(); });
    expect(repository.loadPersonalBenefits).toHaveBeenLastCalledWith("2026-10-01");
    expect(mounts).toHaveBeenCalledTimes(1);
  });

  it.each(["online", "visibilitychange"])("preserves an explicit period after a month change on %s", async (event) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59));
    render(tree("user-a", [benefit]));
    await act(async () => undefined);
    vi.setSystemTime(new Date(2026, 9, 1, 0, 1));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "visible" });
    await act(async () => {
      (event === "online" ? window : document).dispatchEvent(new Event(event));
    });
    expect(repository.loadPersonalBenefits).toHaveBeenLastCalledWith("2026-09-01");
    expect((await readBenefitsCache("user-a", "2026-09-01"))?.benefits).toEqual([benefit]);
    expect(await readBenefitsCache("user-a", "2026-10-01")).toBeNull();
  });

  it.each([true, false])("uses only the new month's cache on a failed resume (cache present: %s)", async (cached) => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date(2026, 8, 30, 23, 59));
    const automaticTree = () => createElement(PersonalBenefitsProvider, {
      userId: "user-a", initialBenefits: [benefit],
    } as PersonalBenefitsProviderProps, createElement(Reader));
    const view = render(automaticTree());
    await act(async () => undefined);
    const october = { ...benefit, id: "october", validFrom: "2026-10-01", validUntil: "2026-10-31" };
    if (cached) await writeBenefitsCache("user-a", [october], "2026-10-01", "2026-10-01T00:00:00Z");
    vi.setSystemTime(new Date(2026, 9, 1, 0, 1));
    repository.loadPersonalBenefits.mockRejectedValue(new Error("private network details"));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    await act(async () => { window.dispatchEvent(new Event("online")); });
    expect(repository.loadPersonalBenefits).toHaveBeenLastCalledWith("2026-10-01");
    expect(context.benefits).toEqual(cached ? [october] : []);
    expect(context.freshness).toBe(cached ? "cached" : "offline");
    expect(context.error).toBe(personalBenefitsLoadError);
    expect(context.isLoading).toBe(false);
    // A new reference to the initial September props must not rehydrate them
    // into October or write September data under the new cache period.
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    view.rerender(automaticTree());
    await act(async () => undefined);
    expect(context.benefits).toEqual(cached ? [october] : []);
    expect((await readBenefitsCache("user-a", "2026-10-01"))?.benefits).toEqual(cached ? [october] : undefined);
    expect((await readBenefitsCache("user-a", "2026-09-01"))?.benefits).toEqual([benefit]);
  });

  it("surfaces typed load errors, retains data, and tolerates cache failures", async () => {
    const failing = adapter();
    failing.writeBenefits = vi.fn().mockRejectedValue(new OfflineStorageUnavailableError());
    setOfflineStorageAdapterForTests(failing);
    render(tree("user-a", [benefit]));
    await act(async () => undefined);
    await act(async () => { await expect(context.refresh()).resolves.toBeUndefined(); });
    expect(context.error).toBeNull();
    repository.loadPersonalBenefits.mockRejectedValue(new Error("private SQL details"));
    await act(async () => { await expect(context.refresh()).rejects.toBeInstanceOf(PersonalBenefitsLoadError); });
    expect(context.error).toBe(personalBenefitsLoadError);
    expect(context.benefits).toEqual([benefit]);
    expect(context.isLoading).toBe(false);
  });

  it("does not let late cache hydration or an older load overwrite fresh server data", async () => {
    let resolveCache!: (value: BenefitsRecord) => void;
    const delayed = adapter();
    delayed.readBenefits = () => new Promise((resolve) => { resolveCache = resolve; });
    setOfflineStorageAdapterForTests(delayed);
    render(tree());
    await act(async () => { await context.refresh(); });
    await act(async () => {
      resolveCache({ userId: "user-a", benefits: [], periodStart: "2026-09-01", updatedAt: "old" });
    });
    expect(context.benefits).toEqual([benefit]);
    let resolveOld!: (value: PersonalBenefit[]) => void;
    repository.loadPersonalBenefits.mockImplementationOnce(() => new Promise((resolve) => { resolveOld = resolve; }));
    let oldRefresh!: Promise<void>;
    await act(async () => { oldRefresh = context.refresh(); });
    await act(async () => { await context.refresh(); });
    await act(async () => { resolveOld([]); await oldRefresh; });
    expect(context.benefits).toEqual([benefit]);
    expect(context.freshness).toBe("server");
  });
});
