/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import webpush from "web-push";

export type DeliveryResult = { ok: boolean; status: number | null; permanent: boolean };

export async function sendWebPush(subscription, payload, vapidPrivateKey, vapidSubject): Promise<DeliveryResult> {
  webpush.setVapidDetails(vapidSubject, Deno.env.get("NEXT_PUBLIC_VAPID_PUBLIC_KEY") ?? "", vapidPrivateKey);
  try {
    const response = await webpush.sendNotification(subscription, JSON.stringify(payload));
    return { ok: true, status: response.statusCode ?? 201, permanent: false };
  } catch (error) {
    const status = typeof error?.statusCode === "number" ? error.statusCode : null;
    return { ok: false, status, permanent: status === 404 || status === 410 };
  }
}
