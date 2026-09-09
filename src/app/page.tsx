import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { getServerSessionData } from "@/lib/auth/server-session";
import { loadPersonalLedgerServer } from "@/lib/finance/personal-ledger-server";

export default async function HomePage() {
  const session = await getServerSessionData();

  if (!session) {
    redirect("/acceso");
  }

  const initialLedger = await loadPersonalLedgerServer(50);

  return (
    <PersonalFinanceProvider initialLedger={initialLedger} userId={session.userId}>
      <AppShell displayName={session.displayName}><PersonalDashboard /></AppShell>
    </PersonalFinanceProvider>
  );
}
