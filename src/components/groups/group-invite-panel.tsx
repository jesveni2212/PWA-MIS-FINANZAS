"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

type Props = { groupId: string; expiresAt?: string };
export function GroupInvitePanel({ groupId, expiresAt: initialExpiry }: Props) {
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState(initialExpiry ?? "");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function generate() {
    setBusy(true); setMessage("");
    const { data, error } = await createClient().rpc("create_group_invite", { target_group_id: groupId });
    setBusy(false);
    if (error || !data?.[0]) { setMessage("No pudimos generar el enlace. Intentá de nuevo."); return; }
    setToken(data[0].invite_token); setExpiresAt(data[0].expires_at);
    setMessage("Enlace generado. Compartilo solo con personas de confianza.");
  }
  async function copy() { if (!token) return; await navigator.clipboard?.writeText(`${window.location.origin}/invitacion/${token}`); setMessage("Enlace copiado."); }
  async function revoke() { const { error } = await createClient().rpc("revoke_group_invites", { target_group_id: groupId }); if (error) setMessage("No pudimos revocar el enlace."); else { setToken(null); setMessage("Enlace revocado."); } }
  return <div className="grid gap-3 rounded-2xl border border-signal/30 bg-signal/5 p-4"><div><h3 className="font-semibold">Invitación general</h3><p className="mt-1 text-sm text-muted">Vence {expiresAt ? new Date(expiresAt).toLocaleDateString("es-PY") : "en 7 días"}. Nadie verá datos del grupo antes de aceptar.</p></div>{token ? <><code className="overflow-hidden rounded-xl border border-border bg-background px-3 py-3 text-xs">{window.location.origin}/invitacion/{token}</code><div className="flex flex-wrap gap-2"><button className="rounded-xl bg-brand px-4 py-2 font-semibold text-brand-foreground" onClick={() => void copy()} type="button">Copiar enlace</button><button className="rounded-xl border border-border px-4 py-2 font-semibold" onClick={() => void generate()} type="button">Regenerar</button><button className="rounded-xl border border-red-300 px-4 py-2 font-semibold text-red-200" onClick={() => void revoke()} type="button">Revocar enlace</button></div></> : <button className="w-fit rounded-xl bg-brand px-4 py-2 font-semibold text-brand-foreground disabled:opacity-70" disabled={busy} onClick={() => void generate()} type="button">{busy ? "Generando…" : "Generar enlace"}</button>}{message ? <p aria-live="polite" className="text-sm">{message}</p> : null}</div>;
}
