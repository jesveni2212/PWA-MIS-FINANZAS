type PublicEnvironment = Record<string, string | undefined>;

const placeholderUrl = "https://your-project.supabase.co";
const placeholderKey = "sb_publishable_replace_me";

function hasValue(value: string | undefined, placeholder: string): boolean {
  return Boolean(value?.trim()) && value !== placeholder;
}

export function isSupabaseConfigured(environment: PublicEnvironment = process.env): boolean {
  return (
    hasValue(environment.NEXT_PUBLIC_SUPABASE_URL, placeholderUrl) &&
    hasValue(environment.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY, placeholderKey)
  );
}

export function isProviderEnabled(
  provider: "google" | "apple",
  environment: PublicEnvironment = process.env,
): boolean {
  const flag = provider === "google"
    ? environment.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED
    : environment.NEXT_PUBLIC_APPLE_AUTH_ENABLED;

  return isSupabaseConfigured(environment) && flag === "true";
}
