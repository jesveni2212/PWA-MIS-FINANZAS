import { cache } from "react";

import { createClient } from "@/lib/supabase/server";

export const getServerSessionData = cache(async (): Promise<{
  userId: string;
  displayName: string | null;
  avatarPath: string | null;
} | null> => {
  const supabase = await createClient();
  const { data: authData, error: authError } = await supabase.auth.getUser();

  if (authError || !authData.user) return null;

  const { data, error: profileError } = await supabase
    .from("profiles")
    .select("display_name,avatar_path")
    .eq("id", authData.user.id)
    .maybeSingle();

  return {
    userId: authData.user.id,
    displayName: profileError ? null : data?.display_name ?? null,
    avatarPath: profileError ? null : data?.avatar_path ?? null,
  };
});
