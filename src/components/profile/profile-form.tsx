"use client";

import { FormEvent, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProfileAvatar } from "@/components/ui/profile-avatar";
import { clearUserData } from "@/lib/offline/storage";

export function ProfileForm() {
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [avatarPath, setAvatarPath] = useState<string | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarSaving, setAvatarSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadProfile() {
      const client = createClient();
      const { data: authData, error: authError } = await client.auth.getUser();
      if (authError || !authData.user) {
        if (active) { setMessage("Tu sesión no está disponible. Volvé a iniciar sesión."); setLoading(false); }
        return;
      }
      const { data, error } = await client.from("profiles").select("display_name,avatar_path").eq("id", authData.user.id).maybeSingle();
      if (!active) return;
      setUserId(authData.user.id);
      setEmail(authData.user.email ?? "");
      if (error) setMessage("No pudimos cargar tu perfil. Intentá de nuevo.");
      else setDisplayName(data?.display_name ?? "");
      setAvatarPath(data?.avatar_path ?? null);
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

  async function handleAvatar(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file || !userId) return;
    if (!file.type.startsWith("image/") || file.size > 5 * 1024 * 1024) { setMessage("Elegí una imagen de hasta 5 MB."); return; }
    setAvatarPreview(URL.createObjectURL(file)); setAvatarSaving(true); setMessage("");
    const client = createClient();
    const path = `${userId}/${crypto.randomUUID()}.${file.name.split(".").pop()?.toLowerCase() ?? "jpg"}`;
    const { error: uploadError } = await client.storage.from("avatars").upload(path, file, { upsert: false });
    if (uploadError) { setAvatarSaving(false); setMessage("No pudimos subir la foto. Intentá de nuevo."); return; }
    const { error: updateError } = await client.from("profiles").update({ avatar_path: path }).eq("id", userId);
    setAvatarSaving(false);
    if (updateError) { setMessage("No pudimos guardar la foto. Intentá de nuevo."); return; }
    setAvatarPath(path); setMessage("Foto de perfil actualizada.");
  }

  async function removeAvatar() {
    if (!userId || !avatarPath) return;
    setAvatarSaving(true); setMessage("");
    const client = createClient();
    await client.storage.from("avatars").remove([avatarPath]);
    const { error } = await client.from("profiles").update({ avatar_path: null }).eq("id", userId);
    setAvatarSaving(false);
    if (error) { setMessage("No pudimos eliminar la foto. Intentá de nuevo."); return; }
    setAvatarPath(null); setAvatarPreview(null); setMessage("Foto de perfil eliminada.");
  }

  async function signOut() {
    setSaving(true);
    if (userId) {
      try {
        await clearUserData(userId);
      } catch {
        // A storage failure must not trap the user in a signed-in session.
      }
    }
    await createClient().auth.signOut();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/acceso");
  }

  if (loading) return <p aria-live="polite">Cargando perfil…</p>;
  if (!userId) return <p aria-live="polite">{message}</p>;

  return (
    <form className="grid max-w-lg gap-5" onSubmit={handleSubmit}>
      <div className="grid gap-3"><span className="text-sm font-semibold">Foto de perfil</span><div className="flex items-center gap-4">{avatarPreview ? <div aria-label="Vista previa de tu foto de perfil" className="size-16 rounded-full bg-cover bg-center" role="img" style={{ backgroundImage: `url(${avatarPreview})` }} /> : <ProfileAvatar label="Tu foto de perfil" path={avatarPath} fallback={displayName} />}<div className="flex flex-wrap gap-2"><label className="w-fit cursor-pointer rounded-xl border border-border px-4 py-2 text-sm font-semibold">{avatarSaving ? "Procesando…" : avatarPath ? "Reemplazar foto" : "Subir foto"}<input accept="image/jpeg,image/png,image/webp" className="sr-only" disabled={avatarSaving} onChange={(event) => void handleAvatar(event)} type="file" /></label>{avatarPath ? <button className="rounded-xl border border-border px-4 py-2 text-sm font-semibold" disabled={avatarSaving} onClick={() => void removeAvatar()} type="button">Eliminar foto</button> : null}</div></div></div>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-email">Correo
        <span className="rounded-xl border border-border bg-background px-4 py-3 font-normal text-muted" id="profile-email">{email}</span>
      </label>
      <label className="grid gap-2 text-sm font-semibold" htmlFor="profile-name">Nombre
        <input className="rounded-xl border border-border bg-background px-4 py-3" id="profile-name" onChange={(event) => setDisplayName(event.target.value)} required value={displayName} />
      </label>
      {message ? <p aria-live="polite" className={message === "Perfil actualizado." ? "text-brand" : "text-red-700"}>{message}</p> : null}
      <button className="w-fit rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:cursor-not-allowed disabled:opacity-70" disabled={saving} type="submit">{saving ? "Guardando…" : "Guardar cambios"}</button>
      <button className="w-fit rounded-xl border border-border px-4 py-3 font-semibold" disabled={saving} onClick={() => void signOut()} type="button">Cerrar sesión</button>
    </form>
  );
}
