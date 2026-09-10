import { createClient } from "@/lib/supabase/client";
import type { SerializedPushSubscription } from "@/lib/notifications/browser";

async function callNotificationRpc(name: string, args: Record<string, unknown>): Promise<void> {
  const { error } = await createClient().rpc(name, args);
  if (error) throw new Error("No pudimos actualizar tus preferencias de notificaciones.");
}

export async function savePushSubscription(subscription: SerializedPushSubscription): Promise<void> {
  await callNotificationRpc("save_push_subscription", { p_endpoint: subscription.endpoint, p_p256dh: subscription.p256dh, p_auth: subscription.auth, p_user_agent: navigator.userAgent });
}

export async function disablePushSubscription(endpoint: string): Promise<void> {
  await callNotificationRpc("disable_push_subscription", { p_endpoint: endpoint });
}

export function setNotificationPreferences(pushEnabled: boolean, inAppEnabled = true): Promise<void> {
  return callNotificationRpc("set_notification_preferences", { p_push_enabled: pushEnabled, p_in_app_enabled: inAppEnabled });
}
