import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { RemindersContent } from "@/components/reminders/reminders-content";
import { getServerSessionData } from "@/lib/auth/server-session";
import { loadRemindersServer } from "@/lib/reminders/server";

export default async function RecordatoriosPage() {
  const session = await getServerSessionData();
  if (!session) redirect("/acceso?next=%2Frecordatorios");
  const initialReminders = await loadRemindersServer();

  return <AppShell avatarPath={session.avatarPath} displayName={session.displayName}><RemindersContent initialReminders={initialReminders} /></AppShell>;
}
