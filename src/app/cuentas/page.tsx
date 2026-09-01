import { AppShell } from "@/components/app-shell";
import { AccountsContent } from "@/components/accounts/accounts-content";

export default function CuentasPage() {
  return <AppShell><section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-12"><h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Cuentas</h1><p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">Organizá tus saldos personales en PYG y USD.</p><div className="mt-10"><AccountsContent /></div></section></AppShell>;
}
