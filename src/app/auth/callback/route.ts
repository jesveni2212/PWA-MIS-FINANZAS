import { NextResponse } from "next/server";
import { safeReturnPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");

  if (code) {
    try {
      const supabase = await createClient();
      await supabase.auth.exchangeCodeForSession(code);
    } catch {
      // Continue to a safe internal route when the PKCE exchange is invalid.
    }
  }

  return NextResponse.redirect(
    new URL(safeReturnPath(requestUrl.searchParams.get("next")), requestUrl.origin),
  );
}
