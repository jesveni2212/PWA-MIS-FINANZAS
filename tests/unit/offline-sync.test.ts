import { beforeEach, describe, expect, it, vi } from "vitest";

import { syncPendingTransactions, type PendingTransaction } from "@/lib/offline/sync";

const pending = (id: string, createdAt: string, status: PendingTransaction["status"] = "pending"): PendingTransaction => ({
  id,
  userId: "user-1",
  draft: { operationType: "expense", sourceAccountId: "cash-1", destinationAccountId: null, amount: 10, occurredOn: "2026-09-09", clientOperationId: `${id}-0000-4000-8000-000000000000` },
  createdAt,
  attempts: 0,
  status,
  lastError: null,
});

describe("syncPendingTransactions", () => {
  beforeEach(() => vi.unstubAllGlobals());

  it("sends one pending operation at a time in created order", async () => {
    const send = vi.fn().mockResolvedValue("transaction-1");
    const remove = vi.fn();
    const records = [pending("later", "2026-09-09T00:00:01.000Z"), pending("first", "2026-09-09T00:00:00.000Z")];

    await expect(syncPendingTransactions("user-1", { list: vi.fn().mockResolvedValue(records), send, remove, update: vi.fn() })).resolves.toEqual({ syncedCount: 2, pendingCount: 0, reviewCount: 0 });
    expect(send.mock.calls.map(([draft]) => draft.clientOperationId)).toEqual([
      "first-0000-4000-8000-000000000000",
      "later-0000-4000-8000-000000000000",
    ]);
    expect(remove.mock.calls).toEqual([["user-1", "first"], ["user-1", "later"]]);
  });

  it("retains retryable errors and marks permanent errors for review", async () => {
    const retry = pending("retry", "2026-09-09T00:00:00.000Z");
    const review = pending("review", "2026-09-09T00:00:01.000Z");
    const update = vi.fn();
    const send = vi.fn().mockRejectedValueOnce(new TypeError("network down")).mockRejectedValueOnce(Object.assign(new Error("invalid payload"), { status: 400 }));

    await expect(syncPendingTransactions("user-1", { list: vi.fn().mockResolvedValue([review, retry]), send, remove: vi.fn(), update })).resolves.toEqual({ syncedCount: 0, pendingCount: 1, reviewCount: 1 });
    expect(update).toHaveBeenNthCalledWith(1, "user-1", "retry", { attempts: 1, status: "pending", lastError: "network down" });
    expect(update).toHaveBeenNthCalledWith(2, "user-1", "review", { attempts: 0, status: "review", lastError: "invalid payload" });
  });

  it("does not send when the browser reports offline", async () => {
    vi.stubGlobal("navigator", { onLine: false });
    const send = vi.fn();

    await expect(syncPendingTransactions("user-1", { list: vi.fn().mockResolvedValue([pending("one", "2026-09-09T00:00:00.000Z")]), send, remove: vi.fn(), update: vi.fn() })).resolves.toEqual({ syncedCount: 0, pendingCount: 1, reviewCount: 0 });
    expect(send).not.toHaveBeenCalled();
  });
});
