"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export function ProfileForm() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const client = createClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) {
        if (active) { setMessage("Tu sesión no está disponible. Volvé a iniciar sesión."); setLoading(false); }
        return;
      }
      const { data, error } = await client.from("profiles").select("display_name").eq("id", authData.user.id).maybeSingle();
      if (!active) return;
      setUserId(authData.user.id);
      setEmail(authData.user.email ?? "");
      if (error) setMessage("No pudimos cargar tu perfil. Intentá de nuevo.");
      else setDisplayName(data?.display_name ?? "");
      setLoading(false);
    }
    void loadProfile();
    return () => { active = false; };
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const normalizedName = displayName.trim();
    if (!normalizedName) { setMessage("Ingresá un nombre para tu perfil."); return; }
    if (!userId) { setMessage("Tu sesión no está disponible. Volvé a iniciar sesión."); return; }
    setSaving(true); setMessage("");
    const { error } = await createClient().from("profiles").update({ display_name: normalizedName }).eq("id", userId);
    setSaving(false);
    if (error) { setMessage("No pudimos guardar tu perfil. Intentá de nuevo."); return; }
    setDisplayName(normalizedName); setMessage("Perfil actualizado.");
  }

  if (loading) return <p aria-live="polite">Cargando perfil…</p>;
  if (!userId) return <p aria-live="polite">{message}</p>;

  return (
    <form className="grid max-w-lg gap-5" onSubmit={handleSubmit}>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-email">Correo
        <span className="rounded-xl border border-border bg-background px-4 py-3 font-normal text-muted" id="profile-email">{email}</span>
      </label>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-name">Nombre
        <input className="rounded-xl border border-border bg-background px-4 py-3" id="profile-name" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
      </label>
      {message ? <p aria-live="polite" className={message === "Perfil actualizado." ? "text-brand" : "text-red-700"}>{message}</p> : null}
      <button className="w-fit rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-70" disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar cambios"}</button>
    </form>
  );
}
