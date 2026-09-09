import type { PersonalTransactionDraft } from "@/lib/finance/types";

export type PendingTransaction = {
  id: string;
  userId: string;
  draft: PersonalTransactionDraft & { clientOperationId: string };
  createdAt: string;
  attempts: number;
  status: "pending" | "review";
  lastError: string | null;
};

export type SyncDependencies = {
  list: (userId: string) => Promise<PendingTransaction[]>;
  send: (draft: PersonalTransactionDraft & { clientOperationId: string }) => Promise<string>;
  remove: (userId: string, pendingId: string) => Promise<void>;
  update: (
    userId: string,
    pendingId: string,
    patch: Pick<PendingTransaction, "attempts" | "status" | "lastError">,
  ) => Promise<void>;
};

export type SyncResult = {
  syncedCount: number;
  pendingCount: number;
  reviewCount: number;
};

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : "No pudimos sincronizar el movimiento.";
}

function errorStatus(error: unknown): number | null {
  if (typeof error !== "object" || error === null || !("status" in error)) return null;
  const status = (error as { status?: unknown }).status;
  return typeof status === "number" ? status : null;
}

export function isRetryableSyncError(error: unknown): boolean {
  const status = errorStatus(error);
  return error instanceof TypeError
    || (error instanceof Error && error.name === "AbortError")
    || status === 408
    || status === 429
    || (status !== null && status >= 500 && status <= 599);
}

function browserIsOnline(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine !== false;
}

export async function syncPendingTransactions(userId: string, dependencies: SyncDependencies): Promise<SyncResult> {
  const records = (await dependencies.list(userId))
    .filter((record) => record.userId === userId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt) || left.id.localeCompare(right.id));
  let syncedCount = 0;
  let pendingCount = records.filter((record) => record.status === "pending").length;
  let reviewCount = records.filter((record) => record.status === "review").length;

  if (!browserIsOnline()) return { syncedCount, pendingCount, reviewCount };

  for (const record of records) {
    if (record.status === "review") continue;

    try {
      await dependencies.send(record.draft);
      await dependencies.remove(userId, record.id);
      syncedCount += 1;
      pendingCount -= 1;
    } catch (error) {
      const lastError = errorMessage(error);
      if (isRetryableSyncError(error)) {
        await dependencies.update(userId, record.id, {
          attempts: record.attempts + 1,
          status: "pending",
          lastError,
        });
        break;
      } else {
        await dependencies.update(userId, record.id, {
          attempts: record.attempts,
          status: "review",
          lastError,
        });
        pendingCount -= 1;
        reviewCount += 1;
      }
    }
  }

  return { syncedCount, pendingCount, reviewCount };
}
