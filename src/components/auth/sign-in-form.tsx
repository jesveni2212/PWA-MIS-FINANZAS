"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthConfigurationNotice } from "@/components/auth/auth-configuration-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

export function SignInForm({ next = "/resumen" }: { next?: string }) {
  const [showNotice, setShowNotice] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) { setShowNotice(true); return; }
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const { error } = await createClient().auth.signInWithPassword({ email: String(form.get("email")), password: String(form.get("password")) });
    setSaving(false);
    if (error) { setMessage("No pudimos iniciar sesión. Revisá tu correo y contraseña."); return; }
    window.location.assign(next);
  }

  return <form className="grid gap-5" onSubmit={handleSubmit}>
    <label className="grid gap-2 text-sm font-semibold">Correo electrónico<input className="rounded-xl border border-border bg-background px-4 py-3" name="email" type="email" required autoComplete="email" /></label>
    <label className="grid gap-2 text-sm font-semibold">Contraseña<input className="rounded-xl border border-border bg-background px-4 py-3" name="password" type="password" required autoComplete="current-password" /></label>
    <input name="next" type="hidden" value={next} />
    {showNotice ? <AuthConfigurationNotice /> : null}{message ? <p aria-live="polite" role="status">{message}</p> : null}
    <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={saving} type="submit">{saving ? "Ingresando…" : "Iniciar sesión"}</button>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><Link className="text-brand underline" href="/recuperar-contrasena">Recuperar contraseña</Link><Link className="text-brand underline" href="/registro">Quiero ser cliente</Link></div>
  </form>;
}
