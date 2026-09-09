# Recordatorios recurrentes y notificaciones web Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir programar gastos fijos e ingresos esperados, mostrar cada vencimiento como recordatorio y enviar notificaciones web cuando el usuario haya concedido permiso, sin crear movimientos contables automáticamente.

**Architecture:** Los recordatorios y sus ocurrencias vivirán en tablas propias protegidas por RLS. La aplicación gestionará el formulario y el estado interno mediante Supabase online-first; una Edge Function programada buscará ocurrencias próximas, registrará cada entrega de forma idempotente y enviará Web Push usando secretos VAPID del backend. El permiso se pedirá solo desde una acción explícita en Perfil y los avisos internos seguirán funcionando aunque el push esté desactivado.

**Tech Stack:** Next.js 16.3.1 App Router, React 19.2.8, TypeScript, Supabase PostgreSQL/RLS/Edge Functions/Scheduler, Web Notifications API, Push API, Service Worker, Vitest, Testing Library y Playwright.

## Global Constraints

- La nueva ruta será `/recordatorios` y aparecerá como opción principal en la navegación lateral y móvil.
- Las periodicidades disponibles desde el primer release serán mensual, semanal, anual y personalizada; mensual será la opción predeterminada.
- Una fecha mensual como el día 31 se ajustará al último día disponible del mes.
- Cada ocurrencia tendrá estado `pendiente`, `pagado` u `omitido`.
- Marcar una ocurrencia como pagada no creará un movimiento financiero automáticamente.
- El usuario podrá configurar nombre, categoría, importe opcional, moneda, regla de vencimiento, anticipación y estado activo.
- El permiso del navegador se solicitará únicamente después de una acción explícita del usuario.
- Los secretos VAPID privados solo existirán en Supabase; la clave pública podrá exponerse al cliente mediante `NEXT_PUBLIC_VAPID_PUBLIC_KEY`.
- Si push no está permitido o no es compatible, los recordatorios internos seguirán funcionando.
- Las tablas, funciones y suscripciones estarán aisladas por usuario con RLS y verificaciones de backend.
- Se ejecutará una validación completa al terminar todos los cambios, además de pruebas focalizadas por tarea.

---

### Task 1: Modelo SQL, ocurrencias, preferencias y seguridad RLS

**Files:**
- Create: `supabase/migrations/20260909120000_recurring_reminders_notifications.sql`
- Create: `supabase/tests/recurring_reminders_security.sql`

**Interfaces:**
- `financial_reminders` stores the recurring rule and next due date.
- `financial_reminder_occurrences` stores one concrete due date and its status.
- `notification_preferences` stores server-side push/in-app preferences.
- `push_subscriptions` stores one Web Push subscription per device endpoint.
- `notification_deliveries` provides per-occurrence/per-device idempotency.
- RPCs: `create_personal_reminder`, `update_personal_reminder`, `resolve_personal_reminder_occurrence`, `postpone_personal_reminder_occurrence`, `set_notification_preferences`, `save_push_subscription`, `disable_push_subscription`.

- [ ] **Step 1: Write the SQL security tests before the migration**

In `supabase/tests/recurring_reminders_security.sql`, create two profiles and assert the following behaviors:

```sql
select throws_ok(
  $$insert into public.financial_reminders(created_by, name, recurrence_type, recurrence_config, next_due_on)
    values ('22222222-2222-4222-8222-222222222222', 'Agua', 'monthly', '{"day": 10}', '2026-09-10')$$,
  '42501',
  null,
  'a user cannot insert a reminder owned by another user'
);

select lives_ok(
  $$select public.create_personal_reminder('Luz', 'Servicios', 50000, 'PYG', 'monthly', '{"day": 31}', '2026-09-01', 3, 'America/Asuncion')$$,
  'an authenticated user can create an owned reminder'
);

with created_reminder as (
  select public.create_personal_reminder(
    'Agua', 'Servicios', null, null, 'monthly', '{"day": 10}',
    '2026-09-01', 1, 'America/Asuncion'
  ) as id
)
select is(
  (select count(*) from public.financial_reminder_occurrences where reminder_id = (select id from created_reminder)),
  1::bigint,
  'creating a reminder creates its first occurrence'
);

select throws_ok(
  $$select public.resolve_personal_reminder_occurrence('99999999-9999-4999-8999-999999999999'::uuid, 'paid')$$,
  '42501',
  null,
  'a user cannot resolve another user occurrence'
);
```

Also test that inserting two delivery rows for the same occurrence and subscription violates the unique constraint, while another user cannot select the first user’s subscriptions or preferences.

Run:

```powershell
corepack pnpm exec supabase test db
```

Expected: FAIL because the tables and RPCs do not exist.

- [ ] **Step 2: Create the reminder and occurrence tables**

Define `public.financial_reminders` with:

```sql
id uuid primary key default extensions.gen_random_uuid(),
created_by uuid not null references public.profiles(id) on delete cascade,
name text not null check (length(trim(name)) > 0),
category text,
amount numeric(14, 2) check (amount is null or amount >= 0),
currency text check (currency is null or currency in ('PYG', 'USD')),
recurrence_type text not null check (recurrence_type in ('weekly', 'monthly', 'annual', 'custom')),
recurrence_config jsonb not null,
start_date date not null,
next_due_on date not null,
notify_days_before smallint not null default 1 check (notify_days_before between 0 and 30),
timezone text not null default 'America/Asuncion',
active boolean not null default true,
created_at timestamptz not null default timezone('utc', now()),
updated_at timestamptz not null default timezone('utc', now())
```

Define `financial_reminder_occurrences` with `id`, `reminder_id`, `due_on`, `status` (`pending`, `paid`, `omitted`), `resolved_at`, `created_at`, and `unique (reminder_id, due_on)`. Add indexes on `(created_by, active, next_due_on)` and `(reminder_id, due_on)`.

Define `notification_preferences` with `profile_id` as both primary key and foreign key, `push_enabled boolean not null default false`, `in_app_enabled boolean not null default true`, and timestamps.

Define `push_subscriptions` with `id`, `profile_id`, unique `endpoint`, `p256dh`, `auth`, `user_agent`, `enabled`, `last_seen_at`, and timestamps. Define `notification_deliveries` with `occurrence_id`, `subscription_id`, `sent_at`, and unique `(occurrence_id, subscription_id)`.

- [ ] **Step 3: Add RLS, grants and owner-only RPCs**

Revoke table access from `anon`, grant only the minimum authenticated access, and add policies so a user can select/insert/update/delete only rows where `created_by = auth.uid()` or where the related reminder/profile belongs to `auth.uid()`.

Implement these RPC contracts:

```sql
create_personal_reminder(
  p_name text,
  p_category text,
  p_amount numeric,
  p_currency text,
  p_recurrence_type text,
  p_recurrence_config jsonb,
  p_start_date date,
  p_notify_days_before smallint,
  p_timezone text
) returns uuid;

update_personal_reminder(
  p_reminder_id uuid,
  p_name text,
  p_category text,
  p_amount numeric,
  p_currency text,
  p_recurrence_type text,
  p_recurrence_config jsonb,
  p_start_date date,
  p_notify_days_before smallint,
  p_timezone text,
  p_active boolean
) returns void;

resolve_personal_reminder_occurrence(
  p_occurrence_id uuid,
  p_status text
) returns uuid;

postpone_personal_reminder_occurrence(
  p_occurrence_id uuid,
  p_next_due_on date
) returns void;

save_push_subscription(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text
) returns uuid;

disable_push_subscription(p_endpoint text) returns void;

set_notification_preferences(
  p_push_enabled boolean,
  p_in_app_enabled boolean
) returns void;
```

The create RPC must validate the recurrence shape, calculate `next_due_on`, insert the first pending occurrence, and return the reminder UUID. The resolve RPC must verify ownership, set the requested status, calculate the next date using the same recurrence rules, create the next occurrence only for an active recurring reminder, and return the next occurrence UUID. The postpone RPC must verify ownership, update only the selected pending occurrence, and preserve the reminder rule. `set_notification_preferences` must upsert only the authenticated user’s preference row. Neither reminder or preference RPC may insert into `personal_transactions`.

- [ ] **Step 4: Add SQL tests for status transitions and anti-duplication**

Assert that `paid`, `omitted`, and `pending` are accepted only in the intended transitions, that resolving an occurrence creates exactly one next occurrence, that resolving it twice returns the same next occurrence instead of creating a duplicate, and that the day-31 monthly rule produces the last day of February, April, June, September, or November when applicable.

- [ ] **Step 5: Run the database tests and commit the schema**

Run:

```powershell
corepack pnpm exec supabase db reset
corepack pnpm exec supabase test db
```

Expected: existing SQL security tests and the new reminder tests pass. Commit:

```powershell
git add supabase/migrations/20260909120000_recurring_reminders_notifications.sql supabase/tests/recurring_reminders_security.sql
git commit -m "feat: add recurring reminders and notification security"
```

### Task 2: Shared recurrence rules and reminder repository

**Files:**
- Create: `src/lib/reminders/types.ts`
- Create: `src/lib/reminders/recurrence.ts`
- Create: `src/lib/reminders/repository.ts`
- Create: `src/lib/reminders/server.ts`
- Create: `tests/unit/reminder-recurrence.test.ts`
- Create: `tests/unit/reminder-repository.test.ts`

**Interfaces:**
- `type RecurrenceType = "weekly" | "monthly" | "annual" | "custom"`
- `type RecurrenceRule = { type: "weekly"; weekday: number } | { type: "monthly"; day: number } | { type: "annual"; month: number; day: number } | { type: "custom"; interval: number; unit: "days" | "weeks" | "months" }`
- `calculateNextDueDate(currentDate: string, rule: RecurrenceRule): string`
- `normalizeReminderRow(row: unknown): Reminder`
- `loadReminders(): Promise<ReminderWithOccurrence[]>`
- `loadRemindersServer(): Promise<ReminderWithOccurrence[]>`
- `createReminder(input: ReminderDraft): Promise<string>`
- `updateReminder(input: ReminderUpdate): Promise<void>`
- `resolveReminderOccurrence(occurrenceId: string, status: ReminderOccurrenceStatus): Promise<void>`
- `postponeReminderOccurrence(occurrenceId: string, nextDueOn: string): Promise<void>`

- [ ] **Step 1: Write failing recurrence tests**

Add tests for:

```ts
expect(calculateNextDueDate("2026-09-10", { type: "weekly", weekday: 4 })).toBe("2026-09-17");
expect(calculateNextDueDate("2026-01-31", { type: "monthly", day: 31 })).toBe("2026-02-28");
expect(calculateNextDueDate("2028-02-29", { type: "annual", month: 2, day: 29 })).toBe("2029-02-28");
expect(calculateNextDueDate("2026-09-09", { type: "custom", interval: 2, unit: "months" })).toBe("2026-11-09");
```

Reject weekday values outside `0..6`, month values outside `1..12`, day values outside `1..31`, intervals less than `1`, and dates that are not ISO `YYYY-MM-DD` strings.

Run:

```powershell
corepack pnpm vitest run tests/unit/reminder-recurrence.test.ts
```

Expected: FAIL because the recurrence module does not exist.

- [ ] **Step 2: Implement UTC-safe recurrence calculations**

Use UTC date construction rather than local `Date` parsing so Paraguay timezone and daylight-saving behavior cannot shift a due date. Implement monthly and annual clamping with `daysInMonth(year, month)`. For custom months, advance the month first and clamp the day to that target month. Return only ISO date strings.

- [ ] **Step 3: Define reminder types and payload validation**

Create types for `Reminder`, `ReminderOccurrence`, `ReminderWithOccurrence`, `ReminderDraft`, and `ReminderUpdate`. `amount` and `currency` remain nullable for variable bills. `notifyDaysBefore` is an integer from `0` to `30`. Keep the browser-only permission state out of the database row types.

- [ ] **Step 4: Implement the authenticated repositories**

Use the browser Supabase client for the RPCs defined in Task 1. Normalize all database rows at the repository boundary. `loadReminders` must select only the current user’s rows through RLS and return the nearest pending occurrence with each active reminder. It must not call `personal_transactions` or alter ledger data.

Implement `loadRemindersServer` in `src/lib/reminders/server.ts` with the server Supabase client, selecting the same fields and returning the same normalized type for the initial RSC payload. Implement `postponeReminderOccurrence` through an owner-checked RPC that updates only the selected occurrence and advances the reminder rule without creating a transaction.

- [ ] **Step 5: Run focused tests and commit recurrence logic**

Run:

```powershell
corepack pnpm vitest run tests/unit/reminder-recurrence.test.ts tests/unit/reminder-repository.test.ts
corepack pnpm typecheck
```

Expected: PASS. Commit:

```powershell
git add src/lib/reminders/types.ts src/lib/reminders/recurrence.ts src/lib/reminders/repository.ts tests/unit/reminder-recurrence.test.ts tests/unit/reminder-repository.test.ts
git commit -m "feat: add reminder rules and repository"
```

### Task 3: Recordatorios page, form, statuses and navigation

**Files:**
- Create: `src/app/recordatorios/page.tsx`
- Create: `src/components/reminders/reminders-content.tsx`
- Create: `src/components/reminders/reminder-form.tsx`
- Create: `src/components/reminders/reminder-card.tsx`
- Create: `tests/unit/reminders-content.test.tsx`
- Create: `tests/unit/reminder-form.test.tsx`
- Modify: `src/lib/site.ts`
- Modify: `src/lib/auth/paths.ts`
- Modify: `src/proxy.ts`
- Modify: `src/components/ui/icon.tsx`
- Modify: `src/components/app-shell.tsx`

**Interfaces:**
- `ReminderForm({ initialValue, onSaved, onCancel })` edits one reminder and calls `onSaved` after the repository succeeds.
- `ReminderCard({ reminder, occurrence, onResolve })` renders the name, optional amount, due date, status and actions.
- `RemindersContent({ initialReminders })` owns list refresh and online error state.

- [ ] **Step 1: Write failing UI tests for navigation and form rules**

Assert that `Recordatorios` appears in desktop and mobile navigation, that its active state uses `aria-current="page"`, and that selecting each recurrence type exposes the correct fields:

- weekly: weekday selector;
- monthly: day-of-month selector/input;
- annual: month and day;
- custom: interval and unit.

Assert that saving a reminder with no name, invalid date rule, negative amount, or notification lead time outside `0..30` is rejected. Assert that marking an occurrence paid calls the resolve repository and does not call `record_personal_transaction`.

Run:

```powershell
corepack pnpm vitest run tests/unit/reminders-content.test.tsx tests/unit/reminder-form.test.tsx tests/unit/app-shell.test.tsx
```

Expected: FAIL because the route, components, and navigation item do not exist.

- [ ] **Step 2: Add the route and protected navigation item**

Add `{ label: "Recordatorios", href: "/recordatorios", icon: "calendar" }` to `site.navigation`. Add `/recordatorios` to `privatePaths` and the proxy matcher. Add a deterministic `calendar` icon to `IconName` and the icon map. Preserve exact route matching behavior for query parameters and nested paths.

The page must obtain the server session, redirect unauthenticated users to `/acceso?next=%2Frecordatorios`, load the initial reminder list, and render `RemindersContent` inside `AppShell`.

- [ ] **Step 3: Implement the reminder form and card actions**

The form must include:

- name and category;
- optional amount and currency;
- recurrence selector with monthly selected initially;
- date/rule fields for all four recurrence types;
- notification lead time;
- active toggle when editing.

The list must group occurrences into `Próximos`, `Vencidos`, `Pagados` and `Omitidos`. Each pending card must offer `Marcar como pagado`, `Posponer` and `Omitir`. `Marcar como pagado` and `Omitir` call the server RPC; `Posponer` edits only the occurrence/reminder schedule through the same authenticated repository. No action calls the transaction RPC.

- [ ] **Step 4: Fit six navigation options on mobile**

Change the mobile navigation layout from five columns to a two-row three-column grid when six options exist. Increase the protected page bottom padding to leave the full navigation visible above the safe-area inset. Keep the desktop sidebar as a single vertical list. Ensure the active reminder link keeps `aria-current="page"` and the approved accent background/text/border.

- [ ] **Step 5: Run focused UI tests and commit the page**

Run:

```powershell
corepack pnpm vitest run tests/unit/reminders-content.test.tsx tests/unit/reminder-form.test.tsx tests/unit/app-shell.test.tsx
corepack pnpm typecheck
```

Expected: PASS. Commit:

```powershell
git add src/app/recordatorios/page.tsx src/components/reminders/reminders-content.tsx src/components/reminders/reminder-form.tsx src/components/reminders/reminder-card.tsx tests/unit/reminders-content.test.tsx tests/unit/reminder-form.test.tsx src/lib/site.ts src/lib/auth/paths.ts src/proxy.ts src/components/ui/icon.tsx src/components/app-shell.tsx
git commit -m "feat: add recurring reminders screen"
```

### Task 4: Profile notification preference and browser permission flow

**Files:**
- Create: `src/lib/notifications/browser.ts`
- Create: `src/lib/notifications/repository.ts`
- Create: `src/components/profile/notification-preferences.tsx`
- Create: `tests/unit/notification-browser.test.ts`
- Create: `tests/unit/notification-preferences.test.tsx`
- Modify: `src/components/profile/profile-form.tsx`
- Modify: `src/app/perfil/page.tsx`
- Modify: `src/components/pwa-register.tsx`
- Modify: `public/sw.js`
- Modify: `.env.example`

**Interfaces:**
- `getBrowserNotificationPermission(): NotificationPermission | "unsupported"`
- `requestPushSubscription(registration: ServiceWorkerRegistration, vapidPublicKey: string): Promise<PushSubscription>`
- `serializePushSubscription(subscription: PushSubscription): { endpoint: string; p256dh: string; auth: string }`
- `savePushSubscription(subscription: SerializedPushSubscription): Promise<void>`
- `disablePushSubscription(endpoint: string): Promise<void>`
- `NotificationPreferences` renders `Activar notificaciones`, `Desactivar notificaciones`, and browser state text.

- [ ] **Step 1: Write failing permission-flow tests**

Mock `Notification.permission`, `Notification.requestPermission`, `navigator.serviceWorker.ready`, and `registration.pushManager.subscribe`. Assert:

1. No browser permission request occurs on component mount.
2. The request occurs only after clicking `Activar notificaciones`.
3. A granted permission serializes the subscription and calls `save_push_subscription`.
4. A denied permission shows instructions to change the browser setting and does not call the backend.
5. Clicking `Desactivar notificaciones` calls `disable_push_subscription` and updates the UI.

Run:

```powershell
corepack pnpm vitest run tests/unit/notification-browser.test.ts tests/unit/notification-preferences.test.tsx
```

Expected: FAIL because the browser helper and preference component do not exist.

- [ ] **Step 2: Implement browser helpers with explicit user gesture**

Use the existing registered Service Worker, call `Notification.requestPermission()` only from the click handler, and return `unsupported` when `Notification`, `serviceWorker`, or `PushManager` is unavailable. Convert the subscription’s `ArrayBuffer` keys to URL-safe base64 before sending them to Supabase. Never send the VAPID private key to the browser.

- [ ] **Step 3: Add the profile preference panel**

Render the preference panel under `Perfil → Preferencias → Notificaciones`. Show one of `Sin configurar`, `Permitido`, `No permitido`, or `No compatible`. Keep an in-app preference enabled by default. If push is denied, explain that the permission must be changed in the browser/device settings; do not repeatedly invoke the native prompt.

Use `src/lib/notifications/repository.ts` for `savePushSubscription`, `disablePushSubscription`, and `setNotificationPreferences`; the component must not construct Supabase queries directly. The repository calls the authenticated RPCs with these payloads:

```ts
await createClient().rpc("save_push_subscription", {
  p_endpoint: subscription.endpoint,
  p_p256dh: subscription.p256dh,
  p_auth: subscription.auth,
  p_user_agent: navigator.userAgent,
});

await createClient().rpc("disable_push_subscription", {
  p_endpoint: endpoint,
});

await createClient().rpc("set_notification_preferences", {
  p_push_enabled: true,
  p_in_app_enabled: true,
});
```

- [ ] **Step 4: Add Service Worker push handlers**

Extend `public/sw.js` with:

```js
self.addEventListener("push", (event) => {
  const payload = event.data?.json() ?? { title: "Mis Finanzas", body: "Tenés un recordatorio pendiente." };
  event.waitUntil(self.registration.showNotification(payload.title, {
    body: payload.body,
    data: { url: payload.url ?? "/recordatorios" },
    tag: payload.tag ?? "mis-finanzas-reminder",
  }));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL(event.notification.data?.url ?? "/recordatorios", self.location.origin).href;
  event.waitUntil(clients.openWindow(target));
});
```

Keep the static-cache restrictions from the hybrid PWA plan; push events must not cache financial responses.

- [ ] **Step 5: Document the public VAPID key and commit the permission flow**

Add `NEXT_PUBLIC_VAPID_PUBLIC_KEY=` to `.env.example` with a comment that the private key belongs only in Supabase secrets. Do not add real keys to the repository.

Run:

```powershell
corepack pnpm vitest run tests/unit/notification-browser.test.ts tests/unit/notification-preferences.test.tsx tests/unit/profile-form.test.tsx
corepack pnpm typecheck
```

Expected: PASS. Commit:

```powershell
git add src/lib/notifications/browser.ts src/components/profile/notification-preferences.tsx tests/unit/notification-browser.test.ts tests/unit/notification-preferences.test.tsx src/components/profile/profile-form.tsx src/app/perfil/page.tsx src/components/pwa-register.tsx public/sw.js .env.example
git commit -m "feat: add browser notification preferences"
```

### Task 5: Scheduled push delivery and in-app fallback

**Files:**
- Create: `supabase/functions/send-reminder-notifications/index.ts`
- Create: `supabase/functions/send-reminder-notifications/deno.json`
- Create: `supabase/functions/_shared/web-push.ts`
- Create: `supabase/tests/notification_delivery.sql`
- Create: `supabase/migrations/20260909130000_notification_delivery_helpers.sql`

**Interfaces:**
- Edge Function entrypoint: `POST /functions/v1/send-reminder-notifications` with an internal scheduler authorization header.
- `sendWebPush(subscription, payload, vapidPrivateKey, vapidSubject): Promise<DeliveryResult>`.
- `notification_deliveries` unique key `(occurrence_id, subscription_id)` is the idempotency boundary.
- `claim_notification_delivery(p_occurrence_id uuid, p_subscription_id uuid): boolean` atomically inserts one delivery claim and returns `false` for a duplicate.

- [ ] **Step 1: Write delivery idempotency tests**

In `supabase/tests/notification_delivery.sql`, create an occurrence and subscription, insert one delivery, assert the second insert is ignored or returns the existing delivery, and assert a disabled preference produces no eligible delivery. Assert that a different device subscription receives its own delivery exactly once.

- [ ] **Step 2: Implement the Edge Function request validation and query**

Require an internal scheduler secret from the request header before using the Supabase service role. Query active pending occurrences whose local due time is within each reminder’s `notify_days_before` window, join enabled subscriptions and `push_enabled` preferences, and select only the reminder name and due date for the notification body.

The function must use the reminder’s IANA timezone to decide eligibility, process records in bounded batches, and call `claim_notification_delivery` before attempting the push. If it returns `false`, skip that delivery. A permanent Web Push response such as HTTP 404 or 410 disables that subscription. A transient response remains enabled and is retried on the next scheduler run.

The migration `20260909130000_notification_delivery_helpers.sql` must define `claim_notification_delivery` as a `security definer` function with `set search_path = public, pg_temp`, revoke it from `public`, and grant it only to `service_role`.

Its body must insert `(p_occurrence_id, p_subscription_id, now())` into `notification_deliveries` with `on conflict (occurrence_id, subscription_id) do nothing`, then return `true` when one row was inserted and `false` otherwise.

- [ ] **Step 3: Implement Web Push signing in the Edge Function**

Use the Deno-compatible `npm:web-push@3.6.7` import declared by `supabase/functions/send-reminder-notifications/deno.json` in `supabase/functions/_shared/web-push.ts`. The file must contain:

```json
{
  "imports": {
    "web-push": "npm:web-push@3.6.7"
  }
}
```

Read `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, and the scheduler secret from Edge Function secrets. Keep the notification payload generic:

```json
{
  "title": "Recordatorio pendiente",
  "body": "Tenés pendiente el pago de Luz.",
  "url": "/recordatorios",
  "tag": "reminder:<occurrence-id>"
}
```

Do not include the full amount in the lock-screen payload; the application displays the amount after navigation.

- [ ] **Step 4: Configure the scheduled invocation without committing secrets**

Configure the Supabase project scheduler to call the Edge Function hourly. Store the scheduler secret, VAPID private key, VAPID subject, and public key through the project’s secret manager. The repository may contain the function and a setup document, but not secret values. The function must return a JSON summary with `eligible`, `sent`, `disabled`, and `failed` counts.

- [ ] **Step 5: Add in-app fallback behavior**

When `/recordatorios` loads, show pending and overdue occurrences regardless of notification permission. Add a compact dashboard card for the nearest pending reminder only when one exists; the card links to `/recordatorios` and does not create a movement. The in-app list remains authoritative when the browser blocks push.

- [ ] **Step 6: Run focused delivery tests and commit the scheduler**

Run:

```powershell
corepack pnpm exec supabase test db
corepack pnpm typecheck
```

Expected: PASS. Commit:

```powershell
git add supabase/functions/send-reminder-notifications/index.ts supabase/functions/send-reminder-notifications/deno.json supabase/functions/_shared/web-push.ts supabase/tests/notification_delivery.sql supabase/migrations/20260909130000_notification_delivery_helpers.sql
git commit -m "feat: schedule reminder push notifications"
```

### Task 6: End-to-end reminder and permission validation

**Files:**
- Create: `tests/e2e/reminders.spec.ts`
- Create: `tests/e2e/notification-permissions.spec.ts`
- Modify: `README.md`

**Interfaces:**
- E2E tests use mocked browser Notification/Push APIs and test Supabase calls through controlled fixtures; they do not send real production pushes.

- [ ] **Step 1: Test reminder CRUD and recurrence UI**

Cover creation of monthly Luz on day 31, weekly Agua, annual insurance, and a custom interval. Assert the correct visible date for a short month, editing, deactivation, paid/omitted status, and no call to the transaction RPC.

- [ ] **Step 2: Test permission behavior on desktop and mobile projects**

Mock permission as `default`, `granted`, `denied`, and unsupported. Assert that the native prompt occurs only after the button click, the preference text updates, the subscription is stored, and denial leaves in-app reminders usable.

- [ ] **Step 3: Test navigation and responsive layout**

Assert that six navigation items render in the desktop sidebar and two mobile rows, that `/recordatorios?x=1` marks `Recordatorios` active, and that clicking a push notification target opens `/recordatorios`.

- [ ] **Step 4: Document required Supabase/VAPID setup**

Update `README.md` with the exact project configuration names:

```text
NEXT_PUBLIC_VAPID_PUBLIC_KEY
VAPID_PRIVATE_KEY
VAPID_SUBJECT
REMINDER_SCHEDULER_SECRET
```

Document that the browser permission must be granted per device, push availability depends on the browser/PWA installation, and in-app reminders remain available without push.

- [ ] **Step 5: Run complete validation after all reminder changes**

Run:

```powershell
corepack pnpm test --pool=forks --maxWorkers=1
corepack pnpm typecheck
npm run lint
npm run build
corepack pnpm test:e2e
git diff --check
git status --short --branch
```

Expected: all tests, typecheck, lint, build, E2E and whitespace checks pass. Commit:

```powershell
git add tests/e2e/reminders.spec.ts tests/e2e/notification-permissions.spec.ts README.md
git commit -m "test: verify reminders and browser notifications"
```
