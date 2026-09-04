import { PasswordRecoveryForm } from "@/components/auth/password-recovery-form";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";

export default async function PasswordRecoveryPage({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const resetMode = (await searchParams).modo === "restablecer";
  return <main className="mx-auto grid min-h-dvh max-w-md content-center px-5 py-10"><section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-10"><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Mis Finanzas</p><h1 className="mt-4 text-4xl font-bold tracking-tight">{resetMode ? "Nueva contraseña" : "Recuperar contraseña"}</h1><p className="mt-3 text-muted">{resetMode ? "Elegí una contraseña nueva para volver a entrar." : "Te ayudaremos a recuperar el acceso a tu cuenta."}</p><div className="mt-8">{resetMode ? <ResetPasswordForm /> : <PasswordRecoveryForm />}</div></section></main>;
}
