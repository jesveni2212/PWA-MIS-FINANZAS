import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { BenefitsContent } from "@/components/benefits/benefits-content";
import { PersonalBenefitsProvider } from "@/components/benefits/personal-benefits-provider";
import { PersonalFinanceProvider } from "@/components/finance/personal-finance-provider";
import { getServerSessionData } from "@/lib/auth/server-session";
import { personalBenefitsLoadError } from "@/lib/benefits/benefit-payload";
import { loadPersonalBenefitsServer } from "@/lib/benefits/server";
import { loadPersonalLedgerServer } from "@/lib/finance/personal-ledger-server";

export default async function BeneficiosPage({ searchParams }: { searchParams: Promise<{ periodo?: string | string[] }> }) {
  const session = await getServerSessionData();
  if (!session) redirect("/acceso");

  const periodo = (await searchParams).periodo;
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const month = typeof periodo === "string" && /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(periodo) ? periodo : currentMonth;
  const periodStart = `${month}-01`;
  const [financeResult, benefitsResult] = await Promise.allSettled([
    loadPersonalLedgerServer(50),
    loadPersonalBenefitsServer(periodStart),
  ]);

  return (
    <PersonalFinanceProvider
      initialLedger={financeResult.status === "fulfilled" ? financeResult.value : { accounts: [], transactions: [] }}
      initialLedgerUpdatedAt={financeResult.status === "fulfilled" ? new Date().toISOString() : null}
      userId={session.userId}
    >
      <AppShell avatarPath={session.avatarPath} displayName={session.displayName}>
        <PersonalBenefitsProvider
          initialBenefits={benefitsResult.status === "fulfilled" ? benefitsResult.value : null}
          initialError={benefitsResult.status === "rejected" ? personalBenefitsLoadError : null}
          periodStart={periodStart}
          userId={session.userId}
        >
          <BenefitsContent key={periodStart} periodStart={periodStart} />
        </PersonalBenefitsProvider>
      </AppShell>
    </PersonalFinanceProvider>
  );
}
