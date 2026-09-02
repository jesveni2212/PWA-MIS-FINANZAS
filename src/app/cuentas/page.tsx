import { AccountsContent } from "@/components/accounts/accounts-content";
import { AppShell } from "@/components/app-shell";

export default function CuentasPage() {
  return <AppShell><section><p className="text-xs font-semibold uppercase tracking-[0.18em] text-signal">Libro personal</p><h1 className="mt-3 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Cuentas y tarjetas</h1><p className="mt-4 max-w-xl text-base leading-7 text-muted sm:text-lg">Organizá tu disponible y tus deudas sin mezclar los grupos compartidos.</p><div className="mt-10"><AccountsContent /></div></section></AppShell>;
}
