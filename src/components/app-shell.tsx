"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { useOptionalPersonalFinance } from "@/components/finance/personal-finance-provider";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { getGreetingLabel } from "@/lib/auth/greeting";
import { isNavigationItemActive } from "@/lib/navigation";
import { site } from "@/lib/site";

type AppShellProps = { children: ReactNode; displayName: string | null; avatarPath?: string | null };
type NavigationItem = (typeof site.navigation)[number];

const balancePreferenceKey = "mis-finanzas:balances-hidden";
const balancePreferenceEvent = "mis-finanzas:balances-hidden-change";

function subscribeToBalanceVisibility(onStoreChange: () => void) {
  window.addEventListener("storage", onStoreChange);
  window.addEventListener(balancePreferenceEvent, onStoreChange);

  return () => {
    window.removeEventListener("storage", onStoreChange);
    window.removeEventListener(balancePreferenceEvent, onStoreChange);
  };
}

function getBalanceVisibilitySnapshot() {
  return window.localStorage.getItem(balancePreferenceKey) === "true";
}

function getServerBalanceVisibilitySnapshot() {
  return false;
}

function getAvatarFallback(displayName: string | null) {
  const words = displayName?.trim().split(/\s+/).filter(Boolean) ?? [];
  if (words.length > 1) return `${words[0][0]}${words.at(-1)?.[0] ?? ""}`;
  return words[0]?.slice(0, 2) || "MF";
}

export function useBalancesHidden() {
  return useSyncExternalStore(
    subscribeToBalanceVisibility,
    getBalanceVisibilitySnapshot,
    getServerBalanceVisibilitySnapshot,
  );
}

function FinanceSyncStatus() {
  const finance = useOptionalPersonalFinance();
  if (!finance) return null;

  const label = finance.isSyncing
    ? "Sincronizando…"
    : finance.freshness === "offline"
      ? "Sin conexión"
      : finance.pendingCount > 0
        ? `${finance.pendingCount} movimientos pendientes`
        : "Actualizado ahora";

  return <p aria-live="polite" className="text-xs font-medium text-muted">{label}</p>;
}

function NavigationLink({ item, pathname }: { item: NavigationItem; pathname: string }) {
  const isActive = isNavigationItemActive(pathname, item.href);
  const isProfile = item.href === "/perfil";

  return (
    <li className={isProfile ? "hidden lg:block" : undefined}>
      <Link
        aria-current={isActive ? "page" : undefined}
        className={`group flex min-h-14 flex-col items-center justify-center gap-1 rounded-xl border px-0.5 py-2 text-center text-[11px] font-semibold leading-tight tracking-[0.02em] transition-colors hover:bg-panel-raised hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:min-h-0 lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:py-3 lg:text-left lg:text-sm ${isActive ? "border-signal/40 bg-brand-soft text-signal" : "border-transparent text-muted"}`}
        href={item.href}
      >
        <Icon className="size-5 shrink-0 transition-transform group-hover:-translate-y-0.5" name={item.icon} />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}

export function AppShell({ children, displayName, avatarPath = null }: AppShellProps) {
  const greeting = getGreetingLabel(displayName);
  const avatarFallback = getAvatarFallback(displayName);
  const balancesHidden = useBalancesHidden();
  const pathname = usePathname();
  const isProfileActive = isNavigationItemActive(pathname, "/perfil");

  function toggleBalanceVisibility() {
    const nextHidden = !balancesHidden;
    window.localStorage.setItem(balancePreferenceKey, String(nextHidden));
    window.dispatchEvent(new Event(balancePreferenceEvent));
  }

  const visibilityLabel = balancesHidden ? "Mostrar saldos" : "Ocultar saldos";

  return (
    <div className="min-h-dvh bg-background text-foreground lg:pl-64">
      <header className="border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-4">
          <p className="shrink-0 font-serif text-xl font-semibold tracking-tight">{site.name}</p>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3">
            <p className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-text">{greeting}</p>
            <Link
              aria-current={isProfileActive ? "page" : undefined}
              aria-label="Abrir perfil"
              className={`grid size-12 shrink-0 place-items-center rounded-full border p-1 transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${isProfileActive ? "border-signal bg-brand-soft" : "border-line bg-panel-raised hover:border-signal"}`}
              href="/perfil"
            >
              <ProfileAvatar fallback={avatarFallback} fallbackIcon={!displayName?.trim()} label="Foto de perfil" path={avatarPath} />
            </Link>
          </div>
        </div>
        <div className="mt-2 text-right"><FinanceSyncStatus /></div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8 pb-48 sm:px-8 lg:px-12 lg:py-12 lg:pb-12">
        {children}
      </main>

      <nav
        aria-label="Navegación principal"
        className="mobile-bottom-nav fixed inset-x-3 z-20 rounded-2xl border border-border/80 bg-panel/95 px-2 py-2 shadow-2xl shadow-black/30 backdrop-blur-xl lg:inset-y-0 lg:inset-x-auto lg:left-0 lg:right-auto lg:w-64 lg:rounded-none lg:border-r lg:border-t-0 lg:px-4 lg:py-6 lg:shadow-none"
      >
        <div className="relative mx-auto max-w-xl lg:flex lg:h-full lg:max-w-none lg:flex-col">
          <div className="hidden border-b border-border/80 px-3 pb-7 lg:block">
            <p className="font-serif text-2xl font-semibold tracking-tight text-text">{site.name}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">Libro personal</p>
            <div className="mt-3"><FinanceSyncStatus /></div>
          </div>

          <ul className="grid grid-cols-5 gap-1 lg:mt-7 lg:block lg:space-y-1">
            {site.navigation.map((item) => <NavigationLink item={item} key={item.href} pathname={pathname} />)}
          </ul>

          <div className="hidden min-w-0 border-t border-border/80 px-3 pt-5 lg:mt-auto lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Tu espacio</p>
            <p className="mt-1 min-w-0 truncate text-sm font-semibold text-text">{greeting}</p>
          </div>

          <button
            aria-pressed={balancesHidden}
            className="absolute -top-14 right-1 grid size-11 place-items-center rounded-full border border-line bg-panel-raised text-text shadow-lg shadow-black/30 transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:static lg:mt-3 lg:flex lg:h-auto lg:w-full lg:items-center lg:justify-center lg:gap-3 lg:rounded-xl lg:px-3 lg:py-3 lg:text-sm lg:font-semibold"
            onClick={toggleBalanceVisibility}
            type="button"
          >
            <Icon className="size-5" name={balancesHidden ? "eye" : "eye-off"} />
            <span className="sr-only lg:not-sr-only">{visibilityLabel}</span>
          </button>
        </div>
      </nav>
    </div>
  );
}
