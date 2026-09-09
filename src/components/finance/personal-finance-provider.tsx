"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";

import { loadPersonalLedger } from "@/lib/finance/personal-ledger";
import type { PersonalAccount, PersonalLedger, PersonalTransactionDraft } from "@/lib/finance/types";

export type PersonalFinanceContextValue = {
  ledger: PersonalLedger;
  freshness: "server" | "cached" | "offline";
  lastUpdatedAt: string | null;
  pendingCount: number;
  isSyncing: boolean;
  refresh: () => Promise<void>;
  recordTransaction: (draft: PersonalTransactionDraft, accounts: PersonalAccount[]) => Promise<void>;
};

type PersonalFinanceProviderProps = {
  userId: string;
  initialLedger: PersonalLedger;
  children: ReactNode;
};

const PersonalFinanceContext = createContext<PersonalFinanceContextValue | null>(null);
const latestLedgerByUser = typeof window === "undefined" ? null : new Map<string, PersonalLedger>();

export function PersonalFinanceProvider({ userId, initialLedger, children }: PersonalFinanceProviderProps) {
  const [ledger, setLedger] = useState(() => initialLedger);
  const [freshness, setFreshness] = useState<PersonalFinanceContextValue["freshness"]>("server");
  const [lastUpdatedAt, setLastUpdatedAt] = useState<string | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const refresh = useCallback(async () => {
    setIsSyncing(true);

    try {
      const nextLedger = await loadPersonalLedger();
      latestLedgerByUser?.set(userId, nextLedger);
      setLedger(nextLedger);
      setFreshness("server");
      setLastUpdatedAt(new Date().toISOString());
    } finally {
      setIsSyncing(false);
    }
  }, [userId]);

  const recordTransaction = useCallback(async (_draft: PersonalTransactionDraft, _accounts: PersonalAccount[]) => {
    throw new Error("Not implemented for this provider task.");
  }, []);

  const value = useMemo<PersonalFinanceContextValue>(() => ({
    ledger,
    freshness,
    lastUpdatedAt,
    pendingCount: 0,
    isSyncing,
    refresh,
    recordTransaction,
  }), [freshness, isSyncing, lastUpdatedAt, ledger, recordTransaction, refresh]);

  return <PersonalFinanceContext.Provider value={value}>{children}</PersonalFinanceContext.Provider>;
}

export function usePersonalFinance(): PersonalFinanceContextValue {
  const value = useContext(PersonalFinanceContext);
  if (!value) throw new Error("usePersonalFinance must be used within PersonalFinanceProvider.");
  return value;
}

export function useOptionalPersonalFinance(): PersonalFinanceContextValue | null {
  return useContext(PersonalFinanceContext);
}
