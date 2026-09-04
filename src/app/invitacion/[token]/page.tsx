"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function InvitationPage() {
  const params = useParams<{ token: string }>();
  const router = useRouter();
  const [message, setMessage] = useState("Comprobando tu invitación…");
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let active = true;
    async function check() {
      const { data } = await createClient().auth.getUser();
      if (!active) return;
      if (!data.user) { router.replace(`/acceso?next=${encodeURIComponent(`/invitacion/${params.token}`)}`); return; }
      setReady(true); setMessage("Tenés una invitación para un grupo compartido.");
    }
    void check(); return () => { active = false; };
  }, [params.token, router]);
  async function accept() {
    const { data, error } = await createClient().rpc("accept_group_invite", { raw_token: params.token });
    if (error || !data?.[0]) { setMessage("Esta invitación ya no está disponible."); return; }
    setMessage(`Ya sos integrante de ${data[0].group_name}.`);
  }
  return <main className="mx-auto grid min-h-dvh max-w-xl place-items-center px-6"><section className="grid w-full gap-5 rounded-[2rem] border border-border bg-panel p-7 text-center"><div className="mx-auto grid size-16 place-items-center rounded-full bg-brand text-2xl font-bold text-brand-foreground">MF</div><h1 className="font-serif text-3xl font-semibold">Invitación de grupo</h1><p aria-live="polite" className="text-muted">{message}</p>{ready ? <button className="rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground" onClick={() => void accept()} type="button">Aceptar invitación</button> : null}</section></main>;
}
