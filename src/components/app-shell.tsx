"use client";

import Link from "next/link";
import { useSyncExternalStore, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";
import { site } from "@/lib/site";

type AppShellProps = { children: ReactNode };

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

export function AppShell({ children }: AppShellProps) {
  const balancesHidden = useSyncExternalStore(
    subscribeToBalanceVisibility,
    getBalanceVisibilitySnapshot,
    getServerBalanceVisibilitySnapshot,
  );

  function toggleBalanceVisibility() {
    const nextHidden = !balancesHidden;
    window.localStorage.setItem(balancePreferenceKey, String(nextHidden));
    window.dispatchEvent(new Event(balancePreferenceEvent));
  }

  const visibilityLabel = balancesHidden ? "Mostrar saldos" : "Ocultar saldos";

  return (
    <div className="min-h-dvh bg-background text-foreground lg:pl-64">
      <header className="border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur lg:hidden">
        <p className="font-serif text-xl font-semibold tracking-tight">{site.name}</p>
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
            {site.navigation.map((item) => (
              <li key={item.href}>
                <Link
                  className="group flex flex-col items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold tracking-[0.02em] text-muted transition-colors hover:bg-panel-raised hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:flex-row lg:gap-3 lg:px-3 lg:py-3 lg:text-sm"
                  href={item.href}
                >
                  <Icon className="size-[18px] transition-transform group-hover:-translate-y-0.5 lg:size-5" name={item.icon} />
                  <span>{item.label}</span>
                </Link>
              </li>
            ))}
          </ul>

          <button
            aria-pressed={balancesHidden}
            className="absolute -top-12 right-2 grid size-10 place-items-center rounded-full border border-line bg-panel-raised text-text shadow-lg shadow-black/30 transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal lg:static lg:mt-auto lg:flex lg:h-auto lg:w-full lg:items-center lg:justify-center lg:gap-3 lg:rounded-xl lg:px-3 lg:py-3 lg:text-sm lg:font-semibold"
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
