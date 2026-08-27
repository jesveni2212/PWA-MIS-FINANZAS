import type { ReactNode } from "react";
import { site } from "@/lib/site";

type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="border-b border-border/80 bg-surface/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-4 sm:px-8">
          <span className="text-lg font-bold tracking-tight">{site.name}</span>
          <span className="rounded-full bg-brand-soft px-3 py-1 text-xs font-semibold text-brand">
            Próximamente
          </span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8 pb-28 sm:px-8 sm:pb-10">
        {children}
      </main>
      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 border-t border-border/80 bg-surface/95 px-3 pb-[env(safe-area-inset-bottom)] backdrop-blur sm:static sm:mx-auto sm:max-w-6xl sm:border-x"
      >
        <ul className="grid grid-cols-2 py-2">
          {site.navigation.filter((item) => item.href !== "/").map((item) => (
            <li key={item.href}>
              <a
                className="block py-2 text-center text-xs font-medium text-muted focus-visible:rounded-md focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand"
                href={item.href}
              >
                {item.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}
