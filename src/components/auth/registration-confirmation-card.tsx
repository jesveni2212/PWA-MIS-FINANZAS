import Link from "next/link";

type RegistrationConfirmationStatus = "success" | "error";

type RegistrationConfirmationCardProps = {
  status: RegistrationConfirmationStatus;
};

export function RegistrationConfirmationCard({ status }: RegistrationConfirmationCardProps) {
  const success = status === "success";
  const title = success ? "Correo confirmado" : "No pudimos confirmar tu correo";
  const description = success
    ? "Tu registro se completó correctamente. Tu cuenta ya está lista."
    : "El enlace puede haber vencido o ya fue utilizado. Volvé a iniciar sesión para continuar.";
  const actionLabel = success ? "Entrar a Mis Finanzas" : "Volver a iniciar sesión";
  const actionHref = success ? "/" : "/acceso";

  return (
    <main className="mx-auto grid min-h-dvh max-w-md content-center px-5 py-10">
      <section className="rounded-[2rem] bg-surface p-7 text-center shadow-sm ring-1 ring-border/70 sm:p-10">
        <p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Mis Finanzas</p>
        <div
          aria-hidden="true"
          className={`mx-auto mt-8 grid size-14 place-items-center rounded-full text-2xl font-bold ${success ? "bg-brand text-brand-foreground" : "bg-danger/15 text-danger"}`}
        >
          {success ? "✓" : "!"}
        </div>
        <h1 className="mt-6 text-3xl font-bold tracking-tight sm:text-4xl">{title}</h1>
        <p className="mt-4 leading-7 text-muted">{description}</p>
        <Link className="mt-8 inline-flex rounded-xl bg-brand px-5 py-3 font-semibold text-brand-foreground" href={actionHref}>
          {actionLabel}
        </Link>
      </section>
    </main>
  );
}
