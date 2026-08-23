"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthConfigurationNotice } from "@/components/auth/auth-configuration-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function SignUpForm() {
  const [showNotice, setShowNotice] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) setShowNotice(true);
  }

  return <form className="grid gap-5" onSubmit={handleSubmit}>
    <label className="grid gap-2 text-sm font-semibold">Correo electrónico<input className="rounded-xl border border-border bg-background px-4 py-3" name="email" type="email" required autoComplete="email" /></label>
    <label className="grid gap-2 text-sm font-semibold">Contraseña<input className="rounded-xl border border-border bg-background px-4 py-3" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
    {showNotice ? <AuthConfigurationNotice /> : null}
    <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground" type="submit">Crear mi cuenta</button>
    <p className="text-sm text-muted">¿Ya tienes una cuenta? <Link className="text-brand underline" href="/acceso">Iniciar sesión</Link></p>
  </form>;
}
