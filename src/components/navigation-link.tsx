"use client";

import Link from "next/link";
import { Icon } from "@/components/ui/icon";
import { isNavigationItemActive } from "@/lib/navigation";
import type { site } from "@/lib/site";

type NavigationItem = (typeof site.navigation)[number];

export function NavigationLink({ item, pathname, onNavigate }: { item: NavigationItem; pathname: string; onNavigate?: () => void }) {
  const isActive = isNavigationItemActive(pathname, item.href);

  return (
    <li>
      <Link
        aria-current={isActive ? "page" : undefined}
        className={`group flex min-h-12 items-center gap-3 rounded-xl border border-transparent px-3 py-3 text-left text-sm font-semibold transition-colors hover:bg-panel-raised hover:text-text focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-signal ${isActive ? "border-signal/40 bg-brand-soft text-signal" : "text-muted"}`}
        href={item.href}
        onClick={onNavigate}
      >
        <Icon className="size-5 shrink-0" name={item.icon} />
        <span>{item.label}</span>
      </Link>
    </li>
  );
}
