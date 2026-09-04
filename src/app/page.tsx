import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { PersonalDashboard } from "@/components/dashboard/personal-dashboard";
import { createClient } from "@/lib/supabase/server";

export default async function HomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/acceso");
  }

  return <AppShell><PersonalDashboard /></AppShell>;
}
