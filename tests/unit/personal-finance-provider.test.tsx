import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PersonalFinanceProvider, usePersonalFinance } from "@/components/finance/personal-finance-provider";

const { enqueueTransaction, listPendingTransactions, loadPersonalLedger, readLedgerCache, recordPersonalTransaction, removePendingTransaction, updatePendingTransaction, writeLedgerCache } = vi.hoisted(() => ({
  enqueueTransaction: vi.fn(),
  listPendingTransactions: vi.fn().mockResolvedValue([]),
  loadPersonalLedger: vi.fn(),
  readLedgerCache: vi.fn().mockResolvedValue(null),
  recordPersonalTransaction: vi.fn(),
  removePendingTransaction: vi.fn(),
  updatePendingTransaction: vi.fn(),
  writeLedgerCache: vi.fn(),
}));

vi.mock("@/lib/finance/personal-ledger", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/finance/personal-ledger")>(),
  loadPersonalLedger,
  recordPersonalTransaction,
}));
vi.mock("@/lib/offline/storage", () => ({
  enqueueTransaction,
  listPendingTransactions,
  removePendingTransaction,
  updatePendingTransaction,
  writeLedgerCache,
  readLedgerCache,
  OfflineStorageUnavailableError: class OfflineStorageUnavailableError extends Error {},
}));

const initialLedger = {
  accounts: [{
    id: "account-1",
    spaceId: "space-1",
    accountType: "bank" as const,
    institution: "Banco",
    name: "Caja",
    currency: "PYG",
    currentBalance: 500000,
  }],
  transactions: [],
};

function LedgerReader() {
  const { ledger } = usePersonalFinance();
  return <p>{ledger.accounts[0]?.name}</p>;
}

function RefreshableLedgerReader() {
  const { ledger, refresh } = usePersonalFinance();

  return <>
    <p>{ledger.accounts[0]?.name}</p>
    <button onClick={() => void refresh()} type="button">Actualizar</button>
  </>;
}

function OfflineTransactionWriter() {
  const { ledger, pendingCount, recordTransaction } = usePersonalFinance();
  return <>
    <p>{ledger.accounts[0]?.currentBalance}</p>
    <p>pendientes: {pendingCount}</p>
    <button onClick={() => void recordTransaction({ operationType: "expense", sourceAccountId: "account-1", destinationAccountId: null, amount: 100, occurredOn: "2026-09-09" }, initialLedger.accounts)} type="button">Guardar sin conexiÃ³n</button>
  </>;
}

function LedgerAndPendingReader() {
  const { ledger, pendingCount } = usePersonalFinance();
  return <p>{ledger.accounts[0]?.name} / pendientes: {pendingCount}</p>;
}

function SyncRevisionReader() {
  const { syncRevision } = usePersonalFinance();
  return <p>revisión de sync: {syncRevision}</p>;
}

describe("PersonalFinanceProvider", () => {
  beforeEach(() => {
    vi.unstubAllGlobals();
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    enqueueTransaction.mockReset();
    listPendingTransactions.mockReset();
    loadPersonalLedger.mockReset();
    readLedgerCache.mockReset();
    recordPersonalTransaction.mockReset();
    removePendingTransaction.mockReset();
    updatePendingTransaction.mockReset();
    writeLedgerCache.mockReset();
    listPendingTransactions.mockResolvedValue([]);
    loadPersonalLedger.mockResolvedValue(initialLedger);
    readLedgerCache.mockResolvedValue(null);
    recordPersonalTransaction.mockResolvedValue("transaction-1");
  });

  afterEach(() => cleanup());

  it("renders the initial ledger synchronously without a loading-only state", () => {
    render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-1">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );

    expect(screen.getByText("Caja")).toBeInTheDocument();
    expect(screen.queryByText(/cargando/i)).not.toBeInTheDocument();
  });

  it("keeps a new server snapshot visible after a prior provider refresh", async () => {
    const refreshedLedger = {
      ...initialLedger,
      accounts: [{ ...initialLedger.accounts[0]!, name: "Caché anterior" }],
    };
    const freshServerLedger = {
      ...initialLedger,
      accounts: [{ ...initialLedger.accounts[0]!, name: "Servidor nuevo" }],
    };
    loadPersonalLedger.mockResolvedValue(refreshedLedger);

    const firstRender = render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-refresh">
        <RefreshableLedgerReader />
      </PersonalFinanceProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(screen.getByText("Caché anterior")).toBeInTheDocument());
    firstRender.unmount();

    render(
      <PersonalFinanceProvider initialLedger={freshServerLedger} initialLedgerUpdatedAt="2999-09-09T00:00:00.000Z" userId="user-refresh">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );

    expect(screen.getByText("Servidor nuevo")).toBeInTheDocument();
  });

  it("hydrates a newer per-user cache after mount", async () => {
    loadPersonalLedger.mockImplementation(() => new Promise(() => undefined));
    readLedgerCache.mockResolvedValueOnce({
      ledger: { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "CachÃ© local" }] },
      updatedAt: "2999-09-09T00:00:00.000Z",
    });

    render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-cache">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );

    await waitFor(() => expect(screen.getByText("CachÃ© local")).toBeInTheDocument());
  });

  it("keeps an offline movement in memory with an optimistic balance and pending count", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    enqueueTransaction.mockResolvedValueOnce({
      id: "pending-1",
      userId: "user-offline",
      draft: { operationType: "expense", sourceAccountId: "account-1", destinationAccountId: null, amount: 100, occurredOn: "2026-09-09", clientOperationId: "22222222-2222-4222-8222-222222222222" },
      createdAt: "2026-09-09T00:00:00.000Z",
      attempts: 0,
      status: "pending",
      lastError: null,
    });
    vi.stubGlobal("crypto", { randomUUID: vi.fn().mockReturnValue("22222222-2222-4222-8222-222222222222") });

    render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-offline">
        <OfflineTransactionWriter />
      </PersonalFinanceProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexiÃ³n" }));

    await waitFor(() => expect(screen.getByText("499900")).toBeInTheDocument());
    expect(screen.getByText("pendientes: 1")).toBeInTheDocument();
    expect(enqueueTransaction).toHaveBeenCalledWith("user-offline", expect.objectContaining({ clientOperationId: "22222222-2222-4222-8222-222222222222" }));
  });

  it("uses a newer in-memory snapshot but never replaces a newer server snapshot", async () => {
    const memoryLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Memoria nueva" }] };
    loadPersonalLedger.mockResolvedValue(memoryLedger);
    const first = render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-memory">
        <RefreshableLedgerReader />
      </PersonalFinanceProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(screen.getByText("Memoria nueva")).toBeInTheDocument());
    first.unmount();

    render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2000-01-01T00:00:00.000Z" userId="user-memory">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );
    expect(screen.getByText("Memoria nueva")).toBeInTheDocument();
  });

  it("adopts a newer same-user server snapshot before cache persistence", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    const olderLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Servidor anterior" }] };
    const newerLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Servidor actualizado" }] };
    const view = render(
      <PersonalFinanceProvider initialLedger={olderLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-refresh-same">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );
    expect(screen.getByText("Servidor anterior")).toBeInTheDocument();

    view.rerender(
      <PersonalFinanceProvider initialLedger={newerLedger} initialLedgerUpdatedAt="2026-09-09T00:01:00.000Z" userId="user-refresh-same">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );
    await waitFor(() => expect(screen.getByText("Servidor actualizado")).toBeInTheDocument());
    await waitFor(() => expect(writeLedgerCache).toHaveBeenLastCalledWith(
      "user-refresh-same",
      expect.objectContaining({ accounts: [expect.objectContaining({ name: "Servidor actualizado" })] }),
      "2026-09-09T00:01:00.000Z",
    ));
  });

  it("discards an older refresh that resolves after a newer same-user server snapshot", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    let resolveRefresh!: (ledger: typeof initialLedger) => void;
    const staleRefreshLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Respuesta anterior" }] };
    const newerLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Servidor mÃ¡s nuevo" }] };
    loadPersonalLedger.mockImplementation(() => new Promise((resolve) => { resolveRefresh = resolve; }));
    const view = render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-refresh-race">
        <RefreshableLedgerReader />
      </PersonalFinanceProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(loadPersonalLedger).toHaveBeenCalledTimes(1));

    view.rerender(
      <PersonalFinanceProvider initialLedger={newerLedger} initialLedgerUpdatedAt="2026-09-09T00:01:00.000Z" userId="user-refresh-race">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );
    await waitFor(() => expect(screen.getByText("Servidor mÃ¡s nuevo")).toBeInTheDocument());
    writeLedgerCache.mockClear();
    resolveRefresh(staleRefreshLedger);

    await waitFor(() => expect(screen.getByText("Servidor mÃ¡s nuevo")).toBeInTheDocument());
    expect(writeLedgerCache).not.toHaveBeenCalledWith(
      "user-refresh-race",
      expect.objectContaining({ accounts: [expect.objectContaining({ name: "Respuesta anterior" })] }),
      expect.any(String),
    );
  });

  it("serializes cache writes when a newer server snapshot arrives during refresh persistence", async () => {
    let releaseOldCache!: () => void;
    const writes: Array<{ ledger: typeof initialLedger; updatedAt: string }> = [];
    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    listPendingTransactions.mockImplementationOnce(() => new Promise(() => undefined));
    const staleRefreshLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Respuesta vieja" }] };
    const newerLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Servidor vigente" }] };
    loadPersonalLedger.mockResolvedValue(staleRefreshLedger);
    writeLedgerCache.mockImplementation((_userId, ledger, updatedAt) => {
      writes.push({ ledger, updatedAt });
      if (writes.length === 1) return new Promise<void>((resolve) => { releaseOldCache = resolve; });
      return Promise.resolve();
    });

    const view = render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt={null} userId="user-refresh-cache-race">
        <RefreshableLedgerReader />
      </PersonalFinanceProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(screen.getByText("Respuesta vieja")).toBeInTheDocument());
    await waitFor(() => expect(writes).toHaveLength(1));

    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    view.rerender(
      <PersonalFinanceProvider initialLedger={newerLedger} initialLedgerUpdatedAt="2999-09-09T00:01:00.000Z" userId="user-refresh-cache-race">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );
    await waitFor(() => expect(screen.getByText("Servidor vigente")).toBeInTheDocument());
    expect(writes).toHaveLength(1);

    releaseOldCache();
    await waitFor(() => expect(writes.length).toBeGreaterThan(1));
    expect(writes.slice(1).every(({ ledger, updatedAt }) =>
      ledger.accounts[0]?.name === "Servidor vigente" && updatedAt === "2999-09-09T00:01:00.000Z",
    )).toBe(true);
  });

  it("resets visible ledger and pending state when the active user changes", async () => {
    loadPersonalLedger.mockImplementation(() => new Promise(() => undefined));
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    listPendingTransactions.mockResolvedValueOnce([{
      id: "pending-a", userId: "user-a", draft: { operationType: "expense", sourceAccountId: "account-1", destinationAccountId: null, amount: 1, occurredOn: "2026-09-09", clientOperationId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa" }, createdAt: "2026-09-09T00:00:00.000Z", attempts: 0, status: "pending", lastError: null,
    }]);
    const firstLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Cuenta A" }] };
    const secondLedger = { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "Cuenta B" }] };
    const view = render(
      <PersonalFinanceProvider initialLedger={firstLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-a">
        <LedgerAndPendingReader />
      </PersonalFinanceProvider>,
    );
    await waitFor(() => expect(screen.getByText("Cuenta A / pendientes: 1")).toBeInTheDocument());

    view.rerender(
      <PersonalFinanceProvider initialLedger={secondLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-b">
        <LedgerAndPendingReader />
      </PersonalFinanceProvider>,
    );
    expect(screen.getByText("Cuenta B / pendientes: 0")).toBeInTheDocument();
  });

  it("uses cached data after a server-load failure", async () => {
    loadPersonalLedger.mockImplementation(() => new Promise(() => undefined));
    readLedgerCache.mockResolvedValueOnce({
      ledger: { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "CachÃ© tras error" }] },
      updatedAt: "2026-09-09T00:00:00.000Z",
    });

    render(
      <PersonalFinanceProvider initialLedger={{ accounts: [], transactions: [] }} initialLedgerUpdatedAt={null} userId="user-server-failure">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );
    await waitFor(() => expect(screen.getByText("CachÃ© tras error")).toBeInTheDocument());
  });

  it("shares one in-flight synchronization pass across repeated browser events", async () => {
    let completeSend!: (value: string) => void;
    recordPersonalTransaction.mockImplementation(() => new Promise<string>((resolve) => { completeSend = resolve; }));
    listPendingTransactions.mockResolvedValueOnce([{
      id: "pending-sync", userId: "user-sync", draft: { operationType: "expense", sourceAccountId: "account-1", destinationAccountId: null, amount: 1, occurredOn: "2026-09-09", clientOperationId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" }, createdAt: "2026-09-09T00:00:00.000Z", attempts: 0, status: "pending", lastError: null,
    }]);

    render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-sync">
        <LedgerAndPendingReader />
      </PersonalFinanceProvider>,
    );
    await waitFor(() => expect(recordPersonalTransaction).toHaveBeenCalledTimes(1));
    window.dispatchEvent(new Event("online"));
    window.dispatchEvent(new Event("online"));
    expect(recordPersonalTransaction).toHaveBeenCalledTimes(1);

    completeSend("transaction-1");
    await waitFor(() => expect(screen.getByText("Caja / pendientes: 0")).toBeInTheDocument());
  });

  it("increments syncRevision only after the authoritative refresh finishes", async () => {
    Object.defineProperty(navigator, "onLine", { configurable: true, value: false });
    let completeSend!: (value: string) => void;
    let completeRefresh!: (ledger: typeof initialLedger) => void;
    recordPersonalTransaction.mockImplementation(() => new Promise<string>((resolve) => { completeSend = resolve; }));
    loadPersonalLedger.mockImplementation(() => new Promise((resolve) => { completeRefresh = resolve; }));
    listPendingTransactions.mockResolvedValueOnce([{
      id: "pending-revision", userId: "user-revision", draft: { operationType: "expense", sourceAccountId: "account-1", destinationAccountId: null, amount: 1, occurredOn: "2026-09-09", clientOperationId: "cccccccc-cccc-4ccc-8ccc-cccccccccccc" }, createdAt: "2026-09-09T00:00:00.000Z", attempts: 0, status: "pending", lastError: null,
    }]);

    render(
      <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt="2026-09-09T00:00:00.000Z" userId="user-revision">
        <SyncRevisionReader />
      </PersonalFinanceProvider>,
    );
    await waitFor(() => expect(screen.getByText("revisión de sync: 0")).toBeInTheDocument());

    Object.defineProperty(navigator, "onLine", { configurable: true, value: true });
    window.dispatchEvent(new Event("online"));
    await waitFor(() => expect(recordPersonalTransaction).toHaveBeenCalledTimes(1));
    completeSend("transaction-1");
    await waitFor(() => expect(loadPersonalLedger).toHaveBeenCalledTimes(1));
    expect(screen.getByText("revisión de sync: 0")).toBeInTheDocument();

    completeRefresh(initialLedger);
    await waitFor(() => expect(screen.getByText("revisión de sync: 1")).toBeInTheDocument());
  });
});
