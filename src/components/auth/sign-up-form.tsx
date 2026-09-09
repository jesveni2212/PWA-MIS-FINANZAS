"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthConfigurationNotice } from "@/components/auth/auth-configuration-notice";
import { getRegistrationConfirmationPagePath, getRegistrationConfirmationRedirect } from "@/lib/auth/redirects";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

export function SignUpForm() {
  const [showNotice, setShowNotice] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) { setShowNotice(true); return; }
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const { data, error } = await createClient().auth.signUp({
      email: String(form.get("email")),
      password: String(form.get("password")),
      options: { emailRedirectTo: getRegistrationConfirmationRedirect(window.location.origin) },
    });
    setSaving(false);
    if (error) { setMessage("No pudimos crear la cuenta. Revisá los datos e intentá de nuevo."); return; }
    if (data.session) {
      window.location.assign(getRegistrationConfirmationPagePath());
      return;
    }
    setMessage("Cuenta creada. Revisá tu correo si se solicita confirmación.");
  }

  return <form className="grid gap-5" onSubmit={handleSubmit}>
    <label className="grid gap-2 text-sm font-semibold">Correo electrónico<input className="rounded-xl border border-border bg-background px-4 py-3" name="email" type="email" required autoComplete="email" /></label>
    <label className="grid gap-2 text-sm font-semibold">Contraseña<input className="rounded-xl border border-border bg-background px-4 py-3" name="password" type="password" required minLength={8} autoComplete="new-password" /></label>
    {showNotice ? <AuthConfigurationNotice /> : null}{message ? <p aria-live="polite" role="status">{message}</p> : null}
    <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={saving} type="submit">{saving ? "Creando…" : "Crear mi cuenta"}</button>
    <p className="text-sm text-muted">¿Ya tienes una cuenta? <Link className="text-brand underline" href="/acceso">Iniciar sesión</Link></p>
  </form>;
}
