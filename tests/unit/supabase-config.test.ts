import { describe, expect, it } from "vitest";
import { isProviderEnabled, isSupabaseConfigured } from "@/lib/supabase/config";

describe("Supabase public configuration", () => {
  it("stays unavailable while using placeholder values", () => {
    expect(isSupabaseConfigured({
      NEXT_PUBLIC_SUPABASE_URL: "https://your-project.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_replace_me",
    })).toBe(false);
  });

  it("requires both public values", () => {
    expect(isSupabaseConfigured({
      NEXT_PUBLIC_SUPABASE_URL: "https://finanzas.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "",
    })).toBe(false);

    expect(isSupabaseConfigured({
      NEXT_PUBLIC_SUPABASE_URL: "https://finanzas.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_real_value",
    })).toBe(true);
  });

  it("enables social providers only with an explicit flag and configuration", () => {
    const configured = {
      NEXT_PUBLIC_SUPABASE_URL: "https://finanzas.supabase.co",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "sb_publishable_real_value",
      NEXT_PUBLIC_GOOGLE_AUTH_ENABLED: "true",
      NEXT_PUBLIC_APPLE_AUTH_ENABLED: "false",
    };

    expect(isProviderEnabled("google", configured)).toBe(true);
    expect(isProviderEnabled("apple", configured)).toBe(false);
  });
});
