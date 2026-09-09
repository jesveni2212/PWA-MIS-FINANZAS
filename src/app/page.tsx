import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { getServerSessionData } from "@/lib/auth/server-session";
import { loadPersonalLedgerServer } from "@/lib/finance/personal-ledger-server";
import type { PersonalLedger } from "@/lib/finance/types";

export default async function HomePage() {
  const session = await getServerSessionData();

  if (!session) {
    redirect("/acceso");
  }

  let initialLedger: PersonalLedger = { accounts: [], transactions: [] };
  let initialLedgerUpdatedAt: string | null = null;
  try {
    initialLedger = await loadPersonalLedgerServer(50);
    initialLedgerUpdatedAt = new Date().toISOString();
  } catch {
    // The client provider may safely recover from its per-user IndexedDB cache.
  }

  return (
    <PersonalFinanceProvider initialLedger={initialLedger} initialLedgerUpdatedAt={initialLedgerUpdatedAt} userId={session.userId}>
      <AppShell displayName={session.displayName}><PersonalDashboard /></AppShell>
    </PersonalFinanceProvider>
  );
}
