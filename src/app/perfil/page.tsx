import { AppShell } from "@/components/app-shell";

export default function PerfilPage() {
  return (
    <AppShell>
      <section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-12">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Próximamente</p>
        <h1 className="mt-5 text-4xl font-bold tracking-tight sm:text-5xl">Perfil</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
          Aquí podrás personalizar tu experiencia cuando esta sección esté disponible.
        </p>
      </section>
    </AppShell>
  );
}
