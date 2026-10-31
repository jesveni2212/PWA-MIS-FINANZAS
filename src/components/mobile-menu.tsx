"use client";

import { useEffect, useRef, type KeyboardEvent } from "react";
import { NavigationLink } from "@/components/navigation-link";
import { Icon } from "@/components/ui/icon";
import { site } from "@/lib/site";

type MobileMenuProps = {
  pathname: string;
  // restoreFocus is true when the menu closes without navigating, so focus returns to the hamburger button.
  onClose: (restoreFocus: boolean) => void;
};

export function MobileMenu({ pathname, onClose }: MobileMenuProps) {
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previousOverflow; };
  }, []);

  useEffect(() => {
    function closeOnEscape(event: globalThis.KeyboardEvent) {
      if (event.key === "Escape") onClose(true);
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [onClose]);

  function keepFocusInside(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Tab") return;
    const focusable = Array.from(event.currentTarget.querySelectorAll<HTMLElement>("a[href], button:not([disabled])"));
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  return (
    <div className="fixed inset-0 z-40 lg:hidden">
      <div aria-hidden="true" className="absolute inset-0 bg-black/60" data-testid="mobile-menu-backdrop" onClick={() => onClose(true)} />
      <div
        aria-label="Menú"
        aria-modal="true"
        className="relative flex h-full w-[min(20rem,85vw)] flex-col border-r border-border/80 bg-background px-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] pt-[max(1.25rem,env(safe-area-inset-top))] shadow-2xl shadow-black/40"
        id="mobile-menu"
        onKeyDown={keepFocusInside}
        role="dialog"
      >
        <div className="flex items-center justify-between gap-3 border-b border-border/80 px-3 pb-5">
          <p className="font-serif text-xl font-semibold tracking-tight text-text">{site.name}</p>
          <button
            aria-label="Cerrar menú"
            className="grid size-11 shrink-0 place-items-center rounded-full border border-line bg-panel-raised text-text transition-colors hover:border-signal hover:text-signal focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal"
            onClick={() => onClose(true)}
            ref={closeButtonRef}
            type="button"
          >
            <Icon className="size-5" name="close" />
          </button>
        </div>
        <nav aria-label="Menú móvil" className="mt-5 overflow-y-auto">
          <ul className="space-y-1">
            {site.navigation.map((item) => <NavigationLink item={item} key={item.href} onNavigate={() => onClose(false)} pathname={pathname} />)}
          </ul>
        </nav>
      </div>
    </div>
  );
}
