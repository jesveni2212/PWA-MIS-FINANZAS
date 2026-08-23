import { SignUpForm } from "@/components/auth/sign-up-form";

export default function RegistrationPage() {
  return <main className="mx-auto grid min-h-dvh max-w-md content-center px-5 py-10"><section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-10"><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Mis Finanzas</p><h1 className="mt-4 text-4xl font-bold tracking-tight">Quiero ser cliente</h1><p className="mt-3 text-muted">Crea tu acceso personal de forma segura.</p><div className="mt-8"><SignUpForm /></div></section></main>;
}
