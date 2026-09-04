"use client";

import { FormEvent, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) { setMessage("La autenticación todavía no está configurada."); return; }
    if (password.length < 8 || password !== confirmation) { setMessage("La contraseña debe tener 8 caracteres y coincidir en ambos campos."); return; }
    setSaving(true); setMessage("");
    const { error } = await createClient().auth.updateUser({ password });
    setSaving(false);
    setMessage(error ? "No pudimos actualizar la contraseña. Volvé a solicitar el enlace." : "Contraseña actualizada. Ya podés iniciar sesión.");
  }
  return <form className="grid gap-5" onSubmit={submit}><label className="grid gap-2 text-sm font-semibold">Nueva contraseña<input className="rounded-xl border border-border bg-background px-4 py-3" minLength={8} required type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} /></label><label className="grid gap-2 text-sm font-semibold">Repetir contraseña<input className="rounded-xl border border-border bg-background px-4 py-3" minLength={8} required type="password" autoComplete="new-password" value={confirmation} onChange={(event) => setConfirmation(event.target.value)} /></label>{message ? <p aria-live="polite" role="status">{message}</p> : null}<button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={saving} type="submit">{saving ? "Guardando…" : "Actualizar contraseña"}</button></form>;
}
