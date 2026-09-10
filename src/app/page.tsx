import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { getServerSessionData } from "@/lib/auth/server-session";
import { loadPersonalLedgerServer } from "@/lib/finance/personal-ledger-server";
import { loadRemindersServer } from "@/lib/reminders/server";
import type { PersonalLedger } from "@/lib/finance/types";
import type { ReminderWithOccurrence } from "@/lib/reminders/types";

export default async function HomePage() {
  const session = await getServerSessionData();

  if (!session) {
    redirect("/acceso");
  }

  let initialLedger: PersonalLedger = { accounts: [], transactions: [] };
  let initialLedgerUpdatedAt: string | null = null;
  let initialReminders: ReminderWithOccurrence[] = [];
  const [ledgerResult, remindersResult] = await Promise.allSettled([loadPersonalLedgerServer(50), loadRemindersServer()]);
  if (ledgerResult.status === "fulfilled") {
    initialLedger = ledgerResult.value;
    initialLedgerUpdatedAt = new Date().toISOString();
  }
  if (remindersResult.status === "fulfilled") initialReminders = remindersResult.value;

  return (
    <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt={initialLedgerUpdatedAt} userId={session.userId}>
      <AppShell avatarPath={session.avatarPath} displayName={session.displayName}><PersonalDashboard initialReminders={initialReminders} /></AppShell>
    </PersonalFinanceProvider>
  );
}
