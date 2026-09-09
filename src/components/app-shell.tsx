"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { getGreetingLabel } from "@/lib/auth/greeting";
import { isNavigationItemActive } from "@/lib/navigation";
import { site } from "@/lib/site";

type AppShellProps = { children: ReactNode; displayName: string | null };

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

export function useBalancesHidden() {
  return useSyncExternalStore(
    subscribeToBalanceVisibility,
    getBalanceVisibilitySnapshot,
    getServerBalanceVisibilitySnapshot,
  );
}

export function AppShell({ children, displayName }: AppShellProps) {
  const greeting = getGreetingLabel(displayName);
  const balancesHidden = useBalancesHidden();
  const pathname = usePathname();

  function toggleBalanceVisibility() {
    const nextHidden = !balancesHidden;
    window.localStorage.setItem(balancePreferenceKey, String(nextHidden));
    window.dispatchEvent(new Event(balancePreferenceEvent));
  }

  const visibilityLabel = balancesHidden ? "Mostrar saldos" : "Ocultar saldos";

  return (
    <div className="min-h-dvh bg-background text-foreground lg:pl-64">
      <header className="border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-4">
          <p className="shrink-0 font-serif text-xl font-semibold tracking-tight">{site.name}</p>
          <p className="min-w-0 flex-1 truncate text-right text-sm font-semibold text-text">{greeting}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8 pb-32 sm:px-8 lg:px-12 lg:py-12 lg:pb-12">
        {children}
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-20 border-t border-border/80 bg-panel/95 px-2 pb-[env(safe-area-inset-bottom)] backdrop-blur-lg lg:inset-y-0 lg:left-0 lg:right-auto lg:w-64 lg:border-r lg:border-t-0 lg:px-4 lg:py-6"
      >
        <div className="relative mx-auto max-w-xl lg:flex lg:h-full lg:max-w-none lg:flex-col">
          <div className="hidden border-b border-border/80 px-3 pb-7 lg:block">
            <p className="font-serif text-2xl font-semibold tracking-tight text-text">{site.name}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">Libro personal</p>
          </div>

          <ul className="grid grid-cols-5 lg:mt-7 lg:block lg:space-y-1">
            {site.navigation.map((item) => {
              const isActive = isNavigationItemActive(pathname, item.href);
              return (
                <li key={item.href}>
                  <Link
                    aria-current={isActive ? "page" : undefined}
                    className={`group flex flex-col items-center gap-1 rounded-xl border px-1 py-2 text-[10px] font-semibold tracking-[0.02em] transition-colors hover:bg-panel-raised hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:flex-row lg:gap-3 lg:px-3 lg:py-3 lg:text-sm ${isActive ? "border-signal/40 bg-brand-soft text-signal" : "border-transparent text-muted"}`}
                    href={item.href}
                  >
                    <Icon className="size-[18px] transition-transform group-hover:-translate-y-0.5 lg:size-5" name={item.icon} />
                    <span>{item.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>

          <div className="hidden min-w-0 border-t border-border/80 px-3 pt-5 lg:mt-auto lg:block">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Tu espacio</p>
            <p className="mt-1 min-w-0 truncate text-sm font-semibold text-text">{greeting}</p>
          </div>

          <button
            aria-pressed={balancesHidden}
            className="absolute -top-12 right-2 grid size-10 place-items-center rounded-full border border-line bg-panel-raised text-text shadow-lg shadow-black/30 transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:static lg:mt-3 lg:flex lg:h-auto lg:w-full lg:items-center lg:justify-center lg:gap-3 lg:rounded-xl lg:px-3 lg:py-3 lg:text-sm lg:font-semibold"
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
