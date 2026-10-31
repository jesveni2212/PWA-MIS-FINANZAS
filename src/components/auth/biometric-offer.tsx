"use client";

import { useRef, useState } from "react";
import { enrollBiometric } from "@/lib/auth/biometric";

export function BiometricOffer({ userId, label, onDone }: { userId: string; label?: string; onDone: () => void }) {
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  const finished = useRef(false);

  function finish() {
    if (finished.current) return;
    finished.current = true;
    onDone();
  }

  async function activate() {
    if (busy || finished.current) return;
    setBusy(true);
    if (await enrollBiometric(userId, label)) { finish(); return; }
    setBusy(false);
    setFailed(true);
  }

  return <section aria-labelledby="biometric-offer-title" className="grid gap-4">
    <h2 className="text-2xl font-bold tracking-tight" id="biometric-offer-title">¿Activar huella o Face ID?</h2>
    <p className="text-muted">Así podés desbloquear la app en este dispositivo sin escribir tu contraseña. La contraseña no se guarda.</p>
    {failed ? <p aria-live="polite" role="status">No pudimos activar la huella. Podés intentarlo más tarde desde tu perfil.</p> : null}
    <div className="flex flex-wrap gap-3">
      {failed
        ? <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground" onClick={finish} type="button">Continuar</button>
        : <>
          <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={busy} onClick={() => void activate()} type="button">Activar</button>
          <button className="rounded-xl border border-border px-4 py-3 font-semibold disabled:opacity-70" disabled={busy} onClick={finish} type="button">Ahora no</button>
        </>}
    </div>
  </section>;
}
