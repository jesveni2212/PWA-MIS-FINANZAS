import { AppShell } from "@/components/app-shell";
import { GroupsContent } from "@/components/groups/groups-content";

export default function GruposPage() {
  return (
    <AppShell>
      <section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-12">
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Grupos</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
          Organizá tus gastos compartidos en grupos con las personas que participan.
        </p>
        <div className="mt-10">
          <GroupsContent />
        </div>
      </section>
    </AppShell>
  );
}
