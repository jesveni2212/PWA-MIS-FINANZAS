"use client";

import { useEffect, useState } from "react";

import { getBrowserNotificationPermission, NotificationPermissionDeniedError, requestPushSubscription, serializePushSubscription, type BrowserNotificationPermission } from "@/lib/notifications/browser";
import { disablePushSubscription, savePushSubscription, setNotificationPreferences } from "@/lib/notifications/repository";

const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "";

export function NotificationPreferences() {
  const [permission, setPermission] = useState<BrowserNotificationPermission>("unsupported");
  const [pushEnabled, setPushEnabled] = useState(false);
  const [subscriptionChecked, setSubscriptionChecked] = useState(false);
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;

    async function syncNotificationState() {
      // The browser permission is an external client snapshot; it must not be requested here.
      const browserPermission = getBrowserNotificationPermission();
      if (active) {
        setPermission(browserPermission);
        setSubscriptionChecked(browserPermission !== "granted");
      }

      if (browserPermission !== "granted" || !("serviceWorker" in navigator)) {
        if (active) setPushEnabled(false);
        return;
      }

      try {
        const registration = await navigator.serviceWorker.ready;
        const subscription = await registration.pushManager.getSubscription();
        if (active) {
          setPushEnabled(Boolean(subscription));
          setSubscriptionChecked(true);
        }
      } catch {
        if (active) {
          setPushEnabled(false);
          setSubscriptionChecked(true);
        }
      }
    }

    const refreshOnVisibility = () => {
      if (document.visibilityState === "visible") void syncNotificationState();
    };

    void syncNotificationState();
    window.addEventListener("focus", refreshOnVisibility);
    document.addEventListener("visibilitychange", refreshOnVisibility);
    return () => {
      active = false;
      window.removeEventListener("focus", refreshOnVisibility);
      document.removeEventListener("visibilitychange", refreshOnVisibility);
    };
  }, []);

  async function enable() {
    setSaving(true); setMessage("");
    try {
      if (!("serviceWorker" in navigator)) throw new Error("Las notificaciones no son compatibles en este dispositivo.");
      const registration = await navigator.serviceWorker.ready;
      const subscription = await requestPushSubscription(registration, vapidPublicKey);
      await savePushSubscription(serializePushSubscription(subscription));
      await setNotificationPreferences(true, true);
      setPermission("granted"); setPushEnabled(true); setSubscriptionChecked(true); setMessage("Notificaciones activadas.");
    } catch (error) {
      setPermission(getBrowserNotificationPermission()); setPushEnabled(false); setSubscriptionChecked(true);
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
      setPushEnabled(false); setSubscriptionChecked(true); setMessage("Notificaciones desactivadas.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "No pudimos desactivar las notificaciones."); }
    finally { setSaving(false); }
  }

  const status = permission === "unsupported" ? "No compatible" : permission === "granted" ? "Permitido" : permission === "denied" ? "No permitido" : "Sin configurar";
  const deviceStatus = permission !== "granted" ? "No configuradas" : !subscriptionChecked ? "Comprobando…" : pushEnabled ? "Activas" : "No configuradas";
  const checkingSubscription = permission === "granted" && !subscriptionChecked;
  return <section aria-labelledby="notification-preferences-heading" className="mt-8 grid gap-3 rounded-2xl border border-border bg-background/45 p-5"><div><h2 className="font-serif text-2xl font-semibold" id="notification-preferences-heading">Preferencias</h2><p className="mt-1 text-sm text-muted">Notificaciones de gastos e ingresos próximos.</p></div><p className="text-sm">Estado del navegador: <strong>{status}</strong></p><p className="text-sm">Estado en este dispositivo: <strong>{deviceStatus}</strong></p>{permission === "denied" ? <p className="text-sm text-muted">Para volver a recibir avisos, habilitá el permiso desde la configuración del navegador o dispositivo.</p> : null}{message ? <p aria-live="polite" role="status" className="text-sm text-muted">{message}</p> : null}{permission !== "unsupported" && permission !== "denied" ? <button className="w-fit rounded-xl bg-brand px-4 py-3 font-semibold text-brand-foreground disabled:opacity-60" disabled={saving || checkingSubscription} onClick={() => void (pushEnabled ? disable() : enable())} type="button">{saving ? "Actualizando…" : checkingSubscription ? "Comprobando…" : pushEnabled ? "Desactivar notificaciones" : "Activar notificaciones"}</button> : null}</section>;
}
