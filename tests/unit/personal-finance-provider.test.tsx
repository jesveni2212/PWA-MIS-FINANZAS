import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { PersonalFinanceProvider, usePersonalFinance } from "@/components/finance/personal-finance-provider";

const { enqueueTransaction, listPendingTransactions, loadPersonalLedger, readLedgerCache, removePendingTransaction, updatePendingTransaction, writeLedgerCache } = vi.hoisted(() => ({
  enqueueTransaction: vi.fn(),
  listPendingTransactions: vi.fn().mockResolvedValue([]),
  loadPersonalLedger: vi.fn(),
  readLedgerCache: vi.fn().mockResolvedValue(null),
  removePendingTransaction: vi.fn(),
  updatePendingTransaction: vi.fn(),
  writeLedgerCache: vi.fn(),
}));

vi.mock("@/lib/finance/personal-ledger", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/lib/finance/personal-ledger")>(),
  loadPersonalLedger,
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

describe("PersonalFinanceProvider", () => {
  it("renders the initial ledger synchronously without a loading-only state", () => {
    render(
      <PersonalFinanceProvider initialLedger={initialLedger} userId="user-1">
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
      <PersonalFinanceProvider initialLedger={initialLedger} userId="user-refresh">
        <RefreshableLedgerReader />
      </PersonalFinanceProvider>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Actualizar" }));
    await waitFor(() => expect(screen.getByText("Caché anterior")).toBeInTheDocument());
    firstRender.unmount();

    render(
      <PersonalFinanceProvider initialLedger={freshServerLedger} userId="user-refresh">
        <LedgerReader />
      </PersonalFinanceProvider>,
    );

    expect(screen.getByText("Servidor nuevo")).toBeInTheDocument();
  });

  it("hydrates a newer per-user cache after mount", async () => {
    readLedgerCache.mockResolvedValueOnce({
      ledger: { ...initialLedger, accounts: [{ ...initialLedger.accounts[0]!, name: "CachÃ© local" }] },
      updatedAt: "2999-09-09T00:00:00.000Z",
    });

    render(
      <PersonalFinanceProvider initialLedger={initialLedger} userId="user-cache">
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
      <PersonalFinanceProvider initialLedger={initialLedger} userId="user-offline">
        <OfflineTransactionWriter />
      </PersonalFinanceProvider>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Guardar sin conexiÃ³n" }));

    await waitFor(() => expect(screen.getByText("499900")).toBeInTheDocument());
    expect(screen.getByText("pendientes: 1")).toBeInTheDocument();
    expect(enqueueTransaction).toHaveBeenCalledWith("user-offline", expect.objectContaining({ clientOperationId: "22222222-2222-4222-8222-222222222222" }));
  });
});
