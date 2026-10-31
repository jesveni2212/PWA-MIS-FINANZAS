"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import { BiometricLock } from "@/components/auth/biometric-lock";
import { Icon } from "@/components/ui/icon";
import { useOptionalPersonalFinance } from "@/components/finance/personal-finance-provider";
import { MobileMenu } from "@/components/mobile-menu";
import { NavigationLink } from "@/components/navigation-link";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { getGreetingLabel } from "@/lib/auth/greeting";
import { isNavigationItemActive } from "@/lib/navigation";
import { site } from "@/lib/site";

type AppShellProps = { children: ReactNode; displayName: string | null; avatarPath?: string | null; userId?: string };

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

export function AppShell({ children, displayName, avatarPath = null, userId }: AppShellProps) {
  const greeting = getGreetingLabel(displayName);
  const avatarFallback = getAvatarFallback(displayName);
  const balancesHidden = useBalancesHidden();
  const pathname = usePathname();
  const isProfileActive = isNavigationItemActive(pathname, "/perfil");
  const [menuOpen, setMenuOpen] = useState(false);
  const menuButtonRef = useRef<HTMLButtonElement>(null);

  const closeMenu = useCallback((restoreFocus: boolean) => {
    setMenuOpen(false);
    if (restoreFocus) menuButtonRef.current?.focus();
  }, []);

  function toggleBalanceVisibility() {
    const nextHidden = !balancesHidden;
    window.localStorage.setItem(balancePreferenceKey, String(nextHidden));
    window.dispatchEvent(new Event(balancePreferenceEvent));
  }

  const visibilityLabel = balancesHidden ? "Mostrar saldos" : "Ocultar saldos";

  return (
    <div className="min-h-dvh bg-background text-foreground lg:pl-64">
      <BiometricLock userId={userId} />
      <header className="border-b border-border/70 bg-background/85 px-5 py-4 backdrop-blur lg:hidden">
        <div className="flex items-center gap-3">
          <button
            aria-controls="mobile-menu"
            aria-expanded={menuOpen}
            aria-label="Abrir menú"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-panel-raised text-text transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            onClick={() => setMenuOpen(true)}
            ref={menuButtonRef}
            type="button"
          >
            <Icon className="size-5" name="menu" />
          </button>
          <p className="shrink-0 font-serif text-xl font-semibold tracking-tight">{site.name}</p>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
            <button
              aria-label={visibilityLabel}
              aria-pressed={balancesHidden}
              className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-panel-raised text-text transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
              onClick={toggleBalanceVisibility}
              type="button"
            >
              <Icon className="size-5" name={balancesHidden ? "eye" : "eye-off"} />
            </button>
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
        <div className="mt-3 flex items-center justify-between gap-3">
          <p className="min-w-0 flex-1 truncate text-left text-sm font-semibold text-text">{greeting}</p>
          <FinanceSyncStatus />
        </div>
      </header>

      <main className="mx-auto w-full max-w-6xl px-5 py-8 pb-[max(2.5rem,env(safe-area-inset-bottom))] sm:px-8 lg:px-12 lg:py-12">
        {children}
      </main>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-y-0 left-0 z-20 hidden w-64 border-r border-border/80 bg-background/90 px-4 py-6 backdrop-blur-lg lg:block"
      >
        <div className="flex h-full flex-col">
          <div className="border-b border-border/80 px-3 pb-7">
            <p className="font-serif text-2xl font-semibold tracking-tight text-text">{site.name}</p>
            <p className="mt-2 text-xs font-medium uppercase tracking-[0.16em] text-muted">Libro personal</p>
            <div className="mt-3"><FinanceSyncStatus /></div>
          </div>

          <ul className="mt-7 space-y-1">
            {site.navigation.map((item) => <NavigationLink item={item} key={item.href} pathname={pathname} />)}
          </ul>

          <div className="mt-auto min-w-0 border-t border-border/80 px-3 pt-5">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted">Tu espacio</p>
            <p className="mt-1 min-w-0 truncate text-sm font-semibold text-text">{greeting}</p>
          </div>

          <button
            aria-pressed={balancesHidden}
            className="mt-3 flex w-full items-center justify-center gap-3 rounded-xl border border-line bg-panel-raised px-3 py-3 text-sm font-semibold text-text transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            onClick={toggleBalanceVisibility}
            type="button"
          >
            <Icon className="size-5" name={balancesHidden ? "eye" : "eye-off"} />
            <span>{visibilityLabel}</span>
          </button>
        </div>
      </nav>

      {menuOpen ? <MobileMenu onClose={closeMenu} pathname={pathname} /> : null}
    </div>
  );
}
