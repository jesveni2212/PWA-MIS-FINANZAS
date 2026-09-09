import { NextResponse } from "next/server";
import { registrationConfirmationPath, safeReturnPath } from "@/lib/auth/paths";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const returnPath = safeReturnPath(requestUrl.searchParams.get("next"));
  const returnUrl = new URL(returnPath, requestUrl.origin);
  const isRegistrationConfirmation = returnUrl.pathname === registrationConfirmationPath;
  let exchangeSucceeded = false;

  if (code) {
    try {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      exchangeSucceeded = !error;
    } catch {
      exchangeSucceeded = false;
    }
  }

  if (isRegistrationConfirmation) {
    const confirmationUrl = new URL(registrationConfirmationPath, requestUrl.origin);
    confirmationUrl.searchParams.set("estado", exchangeSucceeded ? "exitoso" : "error");
    return NextResponse.redirect(confirmationUrl);
  }

  return NextResponse.redirect(returnUrl);
}
