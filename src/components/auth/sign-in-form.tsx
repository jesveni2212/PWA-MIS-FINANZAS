"use client";

import Link from "next/link";
import { FormEvent, useState, useSyncExternalStore } from "react";
import { AuthConfigurationNotice } from "@/components/auth/auth-configuration-notice";
import { BiometricOffer } from "@/components/auth/biometric-offer";
import { clearBiometric, getEnrollment, isBiometricSupported, markUnlocked } from "@/lib/auth/biometric";
import { forgetEmail, getRememberedEmail, rememberEmail } from "@/lib/auth/remembered-email";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/client";

function subscribeToNothing() {
  return () => {};
}

function getServerRememberedEmail() {
  return "";
}

export function SignInForm({ next = "/" }: { next?: string }) {
  const [showNotice, setShowNotice] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [typedEmail, setEmail] = useState<string | null>(null);
  const [rememberChoice, setRemember] = useState<boolean | null>(null);
  const [offerFor, setOfferFor] = useState<{ userId: string; label: string } | null>(null);
  // Browser storage is read after hydration; until the user edits, the stored values drive the fields.
  const stored = useSyncExternalStore(subscribeToNothing, getRememberedEmail, getServerRememberedEmail);
  const email = typedEmail ?? stored;
  const remember = rememberChoice ?? stored !== "";

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!isSupabaseConfigured()) { setShowNotice(true); return; }
    setSaving(true); setMessage("");
    const form = new FormData(event.currentTarget);
    // The submitted value is authoritative: autofill can fill the field without firing input events.
    const submittedEmail = String(form.get("email"));
    const { data, error } = await createClient().auth.signInWithPassword({ email: submittedEmail, password: String(form.get("password")) });
    setSaving(false);
    if (error) { setMessage("No pudimos iniciar sesión. Revisá tu correo y contraseña."); return; }
    if (remember) rememberEmail(submittedEmail); else forgetEmail();
    const userId = data.user?.id;
    const enrollment = getEnrollment();
    if (enrollment && enrollment.userId !== userId) clearBiometric();
    markUnlocked();
    if (userId && enrollment?.userId !== userId && await isBiometricSupported()) { setOfferFor({ userId, label: submittedEmail.trim() }); return; }
    window.location.assign(next);
  }

  if (offerFor) return <BiometricOffer label={offerFor.label} onDone={() => window.location.assign(next)} userId={offerFor.userId} />;

  return <form className="grid gap-5" onSubmit={handleSubmit}>
    <label className="grid gap-2 text-sm font-semibold">Correo electrónico<input className="rounded-xl border border-border bg-background px-4 py-3" name="email" type="email" required autoComplete="email" onChange={(event) => setEmail(event.target.value)} value={email} /></label>
    <label className="grid gap-2 text-sm font-semibold">Contraseña<input className="rounded-xl border border-border bg-background px-4 py-3" name="password" type="password" required autoComplete="current-password" /></label>
    <label className="flex items-center gap-3 text-sm font-semibold"><input checked={remember} className="size-4" name="remember" onChange={(event) => setRemember(event.target.checked)} type="checkbox" />Recordar mi correo</label>
    <input name="next" type="hidden" value={next} />
    {showNotice ? <AuthConfigurationNotice /> : null}{message ? <p aria-live="polite" role="status">{message}</p> : null}
    <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={saving} type="submit">{saving ? "Ingresando…" : "Iniciar sesión"}</button>
    <div className="flex flex-wrap gap-x-4 gap-y-2 text-sm"><Link className="text-brand underline" href="/recuperar-contrasena">Recuperar contraseña</Link><Link className="text-brand underline" href="/registro">Quiero ser cliente</Link></div>
  </form>;
}
