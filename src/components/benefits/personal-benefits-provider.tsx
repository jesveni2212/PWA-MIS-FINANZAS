"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";

import { PersonalBenefitsLoadError, personalBenefitsLoadError } from "@/lib/benefits/benefit-payload";
import { calculateBenefitPreview, findMatchingBenefit } from "@/lib/benefits/matching";
import { createPersonalBenefit, disablePersonalBenefit, duplicatePersonalBenefit, loadPersonalBenefits, personalBenefitSaveError, updatePersonalBenefit } from "@/lib/benefits/repository";
import type { BenefitMatchInput, BenefitPreview, PersonalBenefit, PersonalBenefitDraft } from "@/lib/benefits/types";
import { readBenefitsCache, writeBenefitsCache } from "@/lib/offline/storage";

export type PersonalBenefitsContextValue = {
  benefits: PersonalBenefit[];
  freshness: "server" | "cached" | "offline";
  error: string | null;
  isLoading: boolean;
  refresh: () => Promise<void>;
  createBenefit: (draft: PersonalBenefitDraft) => Promise<void>;
  updateBenefit: (id: string, draft: PersonalBenefitDraft) => Promise<void>;
  duplicateBenefit: (id: string, validFrom: string, validUntil: string) => Promise<void>;
  disableBenefit: (id: string) => Promise<void>;
  preview: (input: BenefitMatchInput) => BenefitPreview | null;
};

export type PersonalBenefitsProviderProps = {
  userId: string;
  initialBenefits: PersonalBenefit[] | null;
  initialError?: string | null;
  periodStart?: string;
  children: ReactNode;
};

type BenefitsState = Pick<PersonalBenefitsContextValue, "benefits" | "freshness" | "error" | "isLoading">;

const PersonalBenefitsContext = createContext<PersonalBenefitsContextValue | null>(null);

function currentPeriodStart(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
}

function online(): boolean {
  return typeof navigator !== "undefined" && navigator.onLine !== false;
}

export function PersonalBenefitsProvider({ periodStart, ...props }: PersonalBenefitsProviderProps) {
  return <PersonalBenefitsProviderForUser key={`${props.userId}:${periodStart ?? "current"}`} {...props} periodStart={periodStart} />;
}

function PersonalBenefitsProviderForUser({ userId, initialBenefits, initialError, periodStart, children }: PersonalBenefitsProviderProps) {
  const [initialPeriod] = useState(() => periodStart ?? currentPeriodStart());
  const [state, setState] = useState<BenefitsState>(() => ({
    benefits: initialBenefits ?? [],
    freshness: initialBenefits === null ? "offline" : "server",
    error: initialError ? personalBenefitsLoadError : null,
    isLoading: false,
  }));
  const mountedRef = useRef(false);
  const generationRef = useRef(0);
  const hasSnapshotRef = useRef(initialBenefits !== null);
  const activePeriodRef = useRef(initialPeriod);
  const cacheWriteQueueRef = useRef(Promise.resolve());

  const persistCache = useCallback((benefits: PersonalBenefit[], generation: number, snapshotPeriod: string) => {
    const updatedAt = new Date().toISOString();
    const write = cacheWriteQueueRef.current.then(async () => {
      if (!mountedRef.current || generationRef.current !== generation) return;
      await writeBenefitsCache(userId, benefits, snapshotPeriod, updatedAt);
    }).catch(() => undefined);
    // Benefit caching is optional. Its failure cannot reject a refresh or a
    // financial movement, and it never touches the ledger/outbox stores.
    cacheWriteQueueRef.current = write;
    return write;
  }, [userId]);

  const restoreCache = useCallback(async (generation: number, snapshotPeriod: string) => {
    try {
      const cache = await readBenefitsCache(userId, snapshotPeriod);
      if (!cache || !mountedRef.current || generationRef.current !== generation || hasSnapshotRef.current) return;
      hasSnapshotRef.current = true;
      setState((previous) => ({ ...previous, benefits: cache.benefits, freshness: "cached" }));
    } catch {
      // The independent ledger must work even if benefit storage is unavailable.
    }
  }, [userId]);

  const refresh = useCallback(async () => {
    if (!mountedRef.current) return;
    const generation = ++generationRef.current;
    const snapshotPeriod = periodStart ?? currentPeriodStart();
    const periodChanged = activePeriodRef.current !== snapshotPeriod;
    activePeriodRef.current = snapshotPeriod;
    if (periodChanged) hasSnapshotRef.current = false;
    setState((previous) => periodChanged
      ? { benefits: [], freshness: "offline", error: null, isLoading: true }
      : { ...previous, isLoading: true });
    try {
      const benefits = await loadPersonalBenefits(snapshotPeriod);
      if (!mountedRef.current || generationRef.current !== generation) return;
      if (benefits === null) {
        setState((previous) => ({ ...previous, freshness: "offline", error: null }));
        await restoreCache(generation, snapshotPeriod);
      } else {
        hasSnapshotRef.current = true;
        setState({ benefits, freshness: "server", error: null, isLoading: false });
        await persistCache(benefits, generation, snapshotPeriod);
      }
    } catch {
      if (!mountedRef.current || generationRef.current !== generation) return;
      setState((previous) => ({ ...previous, freshness: "offline", error: personalBenefitsLoadError }));
      await restoreCache(generation, snapshotPeriod);
      throw new PersonalBenefitsLoadError();
    } finally {
      if (mountedRef.current && generationRef.current === generation) {
        setState((previous) => ({ ...previous, isLoading: false }));
      }
    }
  }, [periodStart, persistCache, restoreCache]);

  const createBenefit = useCallback(async (draft: PersonalBenefitDraft) => {
    await createPersonalBenefit(draft);
    await refresh();
  }, [refresh]);

  const updateBenefit = useCallback(async (id: string, draft: PersonalBenefitDraft) => {
    await updatePersonalBenefit(id, draft);
    await refresh();
  }, [refresh]);

  const duplicateBenefit = useCallback(async (id: string, validFrom: string, validUntil: string) => {
    const benefit = state.benefits.find((benefit) => benefit.id === id);
    if (!benefit || benefit.recurrence !== "monthly") throw new Error(personalBenefitSaveError);
    await duplicatePersonalBenefit(id, validFrom, validUntil, benefit.recurrence);
    await refresh();
  }, [refresh, state.benefits]);

  const disableBenefit = useCallback(async (id: string) => {
    await disablePersonalBenefit(id);
    await refresh();
  }, [refresh]);

  useEffect(() => {
    mountedRef.current = true;
    const generation = ++generationRef.current;
    const hydrate = async () => {
      if (!mountedRef.current || generationRef.current !== generation) return;
      // Initial props belong to the mount period; never cache or restore that
      // snapshot as a later automatic month when hydration runs again.
      if (initialBenefits !== null && activePeriodRef.current === initialPeriod) {
        hasSnapshotRef.current = true;
        setState({ benefits: initialBenefits, freshness: "server", error: initialError ? personalBenefitsLoadError : null, isLoading: false });
        await persistCache(initialBenefits, generation, initialPeriod);
      } else {
        await restoreCache(generation, activePeriodRef.current);
      }
      if (mountedRef.current && generationRef.current === generation && online()) await refresh();
    };
    const onOnline = () => { void refresh().catch(() => undefined); };
    const onOffline = () => {
      generationRef.current += 1;
      setState((previous) => ({ ...previous, freshness: "offline", isLoading: false }));
    };
    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && online()) onOnline();
    };
    void hydrate().catch(() => undefined);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      mountedRef.current = false;
      generationRef.current += 1;
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [initialBenefits, initialError, initialPeriod, persistCache, refresh, restoreCache]);

  const preview = useCallback((input: BenefitMatchInput) => {
    const match = findMatchingBenefit(state.benefits, input);
    return match ? calculateBenefitPreview(match, input) : null;
  }, [state.benefits]);

  const value = useMemo<PersonalBenefitsContextValue>(() => ({
    ...state, refresh, createBenefit, updateBenefit, duplicateBenefit, disableBenefit, preview,
  }), [state, refresh, createBenefit, updateBenefit, duplicateBenefit, disableBenefit, preview]);

  return <PersonalBenefitsContext.Provider value={value}>{children}</PersonalBenefitsContext.Provider>;
}

export function usePersonalBenefits(): PersonalBenefitsContextValue {
  const value = useContext(PersonalBenefitsContext);
  if (!value) throw new Error("usePersonalBenefits must be used within PersonalBenefitsProvider.");
  return value;
}

export function useOptionalPersonalBenefits(): PersonalBenefitsContextValue | null {
  return useContext(PersonalBenefitsContext);
}
