/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
import { createClient } from "npm:@supabase/supabase-js@2";
import { sendWebPush } from "../_shared/web-push.ts";

const batchSize = 100;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

function localDate(timezone) {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date());
  return `${parts.find((part) => part.type === "year")?.value}-${parts.find((part) => part.type === "month")?.value}-${parts.find((part) => part.type === "day")?.value}`;
}

function addDays(date, days) {
  const next = new Date(`${date}T12:00:00Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

Deno.serve(async (request) => {
  if (request.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  const expectedSecret = Deno.env.get("REMINDER_SCHEDULER_SECRET");
  const receivedSecret = request.headers.get("x-reminder-scheduler-secret") ?? request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expectedSecret || receivedSecret !== expectedSecret) return json({ error: "unauthorized" }, 401);

  const supabase = createClient(Deno.env.get("SUPABASE_URL"), Deno.env.get("SUPABASE_SERVICE_ROLE_KEY"));
  const { data: occurrences, error } = await supabase.from("financial_reminder_occurrences")
    .select("id,due_on,reminder:financial_reminders!inner(id,created_by,name,notify_days_before,timezone,active)")
    .eq("status", "pending")
    .eq("reminder.active", true)
    .limit(batchSize);
  if (error) return json({ error: "query_failed" }, 500);

  const summary = { eligible: 0, sent: 0, disabled: 0, failed: 0 };
  for (const occurrence of occurrences ?? []) {
    const reminder = Array.isArray(occurrence.reminder) ? occurrence.reminder[0] : occurrence.reminder;
    if (!reminder) continue;
    const today = localDate(reminder.timezone || "America/Asuncion");
    const lastNotifyDate = addDays(occurrence.due_on, 0);
    const firstNotifyDate = addDays(occurrence.due_on, -Number(reminder.notify_days_before ?? 1));
    if (today < firstNotifyDate || today > lastNotifyDate) continue;
    summary.eligible += 1;

    const { data: preferences } = await supabase.from("notification_preferences").select("push_enabled").eq("profile_id", reminder.created_by).maybeSingle();
    if (!preferences?.push_enabled) continue;
    const { data: subscriptions } = await supabase.from("push_subscriptions").select("id,endpoint,p256dh,auth").eq("profile_id", reminder.created_by).eq("enabled", true).limit(10);
    for (const subscription of subscriptions ?? []) {
      const { data: claimed, error: claimError } = await supabase.rpc("claim_notification_delivery", { p_occurrence_id: occurrence.id, p_subscription_id: subscription.id });
      if (claimError || claimed !== true) continue;
      const result = await sendWebPush({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, { title: "Recordatorio pendiente", body: `Tenés pendiente el pago de ${reminder.name}.`, url: "/recordatorios", tag: `reminder:${occurrence.id}` }, Deno.env.get("VAPID_PRIVATE_KEY"), Deno.env.get("VAPID_SUBJECT"));
      if (result.ok) summary.sent += 1;
      else if (result.permanent) { summary.disabled += 1; await supabase.from("push_subscriptions").update({ enabled: false }).eq("id", subscription.id); }
      else {
        summary.failed += 1;
        await supabase.from("notification_deliveries").delete().eq("occurrence_id", occurrence.id).eq("subscription_id", subscription.id);
      }
    }
  }
  return json(summary);
});
