import { SignInForm } from "@/components/auth/sign-in-form";
import { safeReturnPath } from "@/lib/auth/paths";

type AccessPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

export default async function AccessPage({ searchParams }: AccessPageProps) {
  const { next } = await searchParams;
  const returnPath = safeReturnPath(typeof next === "string" ? next : null);

  return <main className="mx-auto grid min-h-dvh max-w-md content-center px-5 py-10"><section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-10"><p className="text-sm font-bold uppercase tracking-[0.18em] text-brand">Mis Finanzas</p><h1 className="mt-4 text-4xl font-bold tracking-tight">Iniciar sesión</h1><p className="mt-3 text-muted">Accede para continuar con tus finanzas.</p><div className="mt-8"><SignInForm next={returnPath} /></div></section></main>;
}
