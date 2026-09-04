"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthConfigurationNotice } from "@/components/auth/auth-configuration-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

export function PasswordRecoveryForm() {
  const [showNotice, setShowNotice] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) { setShowNotice(true); return; }
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const { error } = await createClient().auth.resetPasswordForEmail(String(form.get("email")), { redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent("/recuperar-contrasena?modo=restablecer")}` });
    setSaving(false);
    setMessage(error ? "No pudimos enviar las instrucciones. Intentá de nuevo." : "Si el correo está registrado, recibirás instrucciones para recuperar el acceso.");
  }

  return <form className="grid gap-5" onSubmit={handleSubmit}>
    <label className="grid gap-2 text-sm font-semibold">Correo electrónico<input className="rounded-xl border border-border bg-background px-4 py-3" name="email" type="email" required autoComplete="email" /></label>
    {showNotice ? <AuthConfigurationNotice /> : null}{message ? <p aria-live="polite" role="status">{message}</p> : null}
    <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={saving} type="submit">{saving ? "Enviando…" : "Enviar instrucciones"}</button>
    <Link className="text-sm text-brand underline" href="/acceso">Volver a iniciar sesión</Link>
  </form>;
}
