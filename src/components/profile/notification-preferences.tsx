"use client";

import { useEffect, useState } from "react";

import { getBrowserNotificationPermission, NotificationPermissionDeniedError, requestPushSubscription, serializePushSubscription, type BrowserNotificationPermission } from "@/lib/notifications/browser";
import { disablePushSubscription, savePushSubscription, setNotificationPreferences } from "@/lib/notifications/repository";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function NotificationPreferences() {
  const [permission, setPermission] = useState<BrowserNotificationPermission>("unsupported");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    // The browser permission is an external client snapshot; it must not be requested here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPermission(getBrowserNotificationPermission());
  }, []);

  async function enable() {
    setSaving(true); setMessage("");
    try {
      if (!("serviceWorker" in navigator)) throw new Error("Las notificaciones no son compatibles en este dispositivo.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await requestPushSubscription(registration, vapidPublicKey);
      await savePushSubscription(serializePushSubscription(subscription));
      await setNotificationPreferences(true, true);
      setPermission("granted"); setPushEnabled(true); setMessage("Notificaciones activadas.");
    } catch (error) {
      setPermission(getBrowserNotificationPermission());
      setMessage(error instanceof NotificationPermissionDeniedError ? "Las notificaciones están bloqueadas. Cambiá el permiso desde la configuración del navegador." : error instanceof Error ? error.message : "No pudimos activar las notificaciones.");
    } finally { setSaving(false); }
  }

  async function disable() {
    setSaving(true); setMessage("");
    try {
      if ("serviceWorker" in navigator) {
        const subscription = await (await navigator.serviceWorker.ready).pushManager.getSubscription();
        if (subscription) { await disablePushSubscription(subscription.endpoint); await subscription.unsubscribe(); }
      }
      await setNotificationPreferences(false, true);
      setPushEnabled(false); setMessage("Notificaciones desactivadas.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos desactivar las notificaciones."); }
    finally { setSaving(false); }
  }

  const status = permission === "unsupported" ? "No compatible" : permission === "granted" ? "Permitido" : permission === "denied" ? "No permitido" : "Sin configurar";
  return <section aria-labelledby="notification-preferences-heading" className="mt-8 grid gap-3 rounded-2xl border border-border bg-background/45 p-5"><div><h2 className="font-serif text-2xl font-semibold" id="notification-preferences-heading">Preferencias</h2><p className="mt-1 text-sm text-muted">Notificaciones de gastos e ingresos próximos.</p></div><p className="text-sm">Estado del navegador: <strong>{status}</strong></p>{permission === "denied" ? <p className="text-sm text-muted">Para volver a recibir avisos, habilitá el permiso desde la configuración del navegador o dispositivo.</p> : null}{message ? <p aria-live="polite" role="status" className="text-sm text-muted">{message}</p> : null}{permission !== "unsupported" && permission !== "denied" ? <button className="w-fit rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-60" disabled={saving} onClick={() => void (pushEnabled ? disable() : enable())} type="button">{saving ? "Actualizando…" : pushEnabled ? "Desactivar notificaciones" : "Activar notificaciones"}</button> : null}</section>;
}
