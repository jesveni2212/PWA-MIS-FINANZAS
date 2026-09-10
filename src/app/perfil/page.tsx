import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { ProfileForm } from "@/components/profile/profile-form";
import { NotificationPreferences } from "@/components/profile/notification-preferences";
import { getServerSessionData } from "@/lib/auth/server-session";

export default async function PerfilPage() {
  const session = await getServerSessionData();
  if (!session) redirect("/acceso");

  return (
    <AppShell avatarPath={session.avatarPath} displayName={session.displayName}>
      <section className="rounded-[2rem] bg-surface p-7 shadow-sm ring-1 ring-border/70 sm:p-12">
        <h1 className="text-4xl font-bold tracking-tight sm:text-5xl">Perfil</h1>
        <p className="mt-5 max-w-xl text-base leading-7 text-muted sm:text-lg">
          Mantené actualizado el nombre con el que te reconocemos.
        </p>
        <div className="mt-10"><ProfileForm /><NotificationPreferences /></div>
      </section>
    </AppShell>
  );
}
