export type BrowserNotificationPermission = NotificationPermission | "unsupported";

export type SerializedPushSubscription = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

export class NotificationPermissionDeniedError extends Error {
  constructor() {
    super("Las notificaciones están bloqueadas en este navegador o dispositivo.");
    this.name = "NotificationPermissionDeniedError";
  }
}

export function getBrowserNotificationPermission(): BrowserNotificationPermission {
  if (typeof Notification === "undefined" || typeof navigator === "undefined" || !("serviceWorker" in navigator) || typeof PushManager === "undefined") return "unsupported";
  return Notification.permission;
}

function encodeBase64(value: ArrayBuffer): string {
  const bytes = new Uint8Array(value);
  let binary = "";
  bytes.forEach((byte) => { binary += String.fromCharCode(byte); });
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/u, "");
}

function decodeBase64(value: string): ArrayBuffer {
  const padded = value.replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0)).buffer as ArrayBuffer;
}

export async function requestPushSubscription(registration: ServiceWorkerRegistration, vapidPublicKey: string): Promise<PushSubscription> {
  const currentPermission = getBrowserNotificationPermission();
  if (currentPermission === "unsupported" || !vapidPublicKey) throw new Error("Las notificaciones no son compatibles en este dispositivo.");
  if (currentPermission === "denied") throw new NotificationPermissionDeniedError();
  const permission = await Notification.requestPermission();
  if (permission !== "granted") throw new NotificationPermissionDeniedError();
  return registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: decodeBase64(vapidPublicKey) });
}

export function serializePushSubscription(subscription: PushSubscription): SerializedPushSubscription {
  const p256dh = subscription.getKey("p256dh");
  const auth = subscription.getKey("auth");
  if (!p256dh || !auth) throw new Error("La suscripción de notificaciones está incompleta.");
  return { endpoint: subscription.endpoint, p256dh: encodeBase64(p256dh), auth: encodeBase64(auth) };
}
