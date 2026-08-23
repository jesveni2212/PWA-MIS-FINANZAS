"use client";

import Link from "next/link";
import { FormEvent, useState } from "react";
import { AuthConfigurationNotice } from "@/components/auth/auth-configuration-notice";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function SignInForm({ next = "/resumen" }: { next?: string }) {
  const [showNotice, setShowNotice] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) setShowNotice(true);
  }

  return <form className="grid gap-5" onSubmit={handleSubmit}>
    <label className="grid gap-2 text-sm font-semibold">Correo electrónico<input className="rounded-xl border border-border bg-background px-4 py-3" name="email" type="email" required autoComplete="email" /></label>
    <label className="grid gap-2 text-sm font-semibold">Contraseña<input className="rounded-xl border border-border bg-background px-4 py-3" name="password" type="password" required autoComplete="current-password" /></label>
    <input name="next" type="hidden" value={next} />
    {showNotice ? <AuthConfigurationNotice /> : null}
    <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground" type="submit">Iniciar sesión</button>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><Link className="text-brand underline" href="/recuperar-contrasena">Recuperar contraseña</Link><Link className="text-brand underline" href="/registro">Quiero ser cliente</Link></div>
  </form>;
}
