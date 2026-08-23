import { AppShell } from "@/components/app-shell";
import Link from "next/link";

export default function HomePage() {
  return (
    <AppShell>
      <section className="overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand via-brand to-brand-bright p-7 text-brand-foreground shadow-xl shadow-brand/20 sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand-foreground/75">PWA de finanzas</p>
        <h1 className="mt-5 max-w-2xl text-4xl font-bold tracking-tight sm:text-6xl">Una base clara para tus finanzas.</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-brand-foreground/85 sm:text-lg">Pronto podrás gestionar cuentas, gastos y grupos desde cualquier dispositivo.</p>
        <div className="mt-8 grid gap-3 sm:grid-cols-3">
          <article className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20"><p className="text-xs text-brand-foreground/70">Visión mensual</p><p className="mt-2 font-semibold">Todo en contexto</p></article>
          <article className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20"><p className="text-xs text-brand-foreground/70">Movimientos</p><p className="mt-2 font-semibold">Registro simple</p></article>
          <article className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/20"><p className="text-xs text-brand-foreground/70">Grupos</p><p className="mt-2 font-semibold">Cuentas claras</p></article>
        </div>
        <div className="mt-8 flex flex-wrap gap-3">
          <Link className="rounded-xl bg-white px-5 py-3 font-semibold text-brand" href="/registro">Quiero ser cliente</Link>
          <Link className="rounded-xl border border-white/40 px-5 py-3 font-semibold text-brand-foreground" href="/acceso">Iniciar sesión</Link>
        </div>
      </section>
    </AppShell>
  );
}
