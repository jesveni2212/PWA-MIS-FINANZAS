"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  clearBiometric,
  getEnrollment,
  isUnlocked,
  markHidden,
  markLocked,
  markUnlocked,
  shouldRelock,
  unlockWithBiometric,
} from "@/lib/auth/biometric";
import { clearUserData } from "@/lib/offline/storage";
import { createClient } from "@/lib/supabase/client";

// An enrollment only guards the user who created it; for anyone else it is stale and must not lock their session.
function ownedEnrollment(userId?: string) {
  const enrollment = getEnrollment();
  if (enrollment && userId && enrollment.userId !== userId) { clearBiometric(); return null; }
  return enrollment;
}

export function BiometricLock({ userId }: { userId?: string }) {
  const [locked, setLocked] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const prompting = useRef(false);

  useEffect(() => {
    // Browser storage is only readable after mount; reading it in the initializer would break hydration.
    if (!ownedEnrollment(userId)) return;
    // A restored page can skip visibilitychange, so the background threshold is checked here too.
    if (!isUnlocked()) setLocked(true); // eslint-disable-line react-hooks/set-state-in-effect
    else if (shouldRelock()) { markLocked(); setLocked(true); }
  }, [userId]);

  useEffect(() => {
    function onVisibilityChange() {
      if (document.hidden) { markHidden(); return; }
      if (ownedEnrollment(userId) && shouldRelock()) { markLocked(); setLocked(true); }
    }
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => document.removeEventListener("visibilitychange", onVisibilityChange);
  }, [userId]);

  const attempt = useCallback(async () => {
    if (prompting.current) return;
    prompting.current = true;
    try {
      if (await unlockWithBiometric()) { markUnlocked(); setLocked(false); }
    } finally {
      prompting.current = false;
    }
  }, []);

  useEffect(() => {
    if (locked) void attempt();
  }, [locked, attempt]);

  async function leaveWithPassword() {
    setLeaving(true);
    const enrollment = getEnrollment();
    if (enrollment) {
      try {
        await clearUserData(enrollment.userId);
      } catch {
        // A storage failure must not trap the user behind the lock.
      }
    }
    // Keep the enrollment unless sign-out really ended the session; otherwise the lock would vanish with the session alive.
    let signedOut = false;
    try {
      const { error } = await createClient().auth.signOut();
      signedOut = !error;
    } catch {
      // Leave anyway; the proxy redirects unauthenticated requests.
    }
    if (signedOut) clearBiometric();
    // eslint-disable-next-line @next/next/no-location-assign-relative-destination
    window.location.assign("/acceso");
  }

  if (!locked) return null;

  return <div aria-label="Aplicación bloqueada" aria-modal="true" className="fixed inset-0 z-50 grid place-items-center bg-background px-5" role="dialog">
    <div className="grid w-full max-w-sm gap-5 text-center">
      <p className="font-serif text-3xl font-semibold tracking-tight">Mis Finanzas</p>
      <p className="text-muted">La app está bloqueada. Desbloqueala con tu huella o Face ID.</p>
      <button className="rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-70" disabled={leaving} onClick={() => void attempt()} type="button">Desbloquear con huella o Face ID</button>
      <button className="rounded-xl border border-border px-4 py-3 font-semibold disabled:opacity-70" disabled={leaving} onClick={() => void leaveWithPassword()} type="button">Usar contraseña</button>
    </div>
  </div>;
}
