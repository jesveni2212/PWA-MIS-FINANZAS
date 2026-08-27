import { NextResponse, type NextRequest } from "next/server";
import { isPrivatePath } from "@/lib/auth/paths";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  if (!isPrivatePath(request.nextUrl.pathname) || user) return response;

  const accessUrl = new URL("/acceso", request.url);
  accessUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  const redirectResponse = NextResponse.redirect(accessUrl);

  response.cookies.getAll().forEach((cookie) => redirectResponse.cookies.set(cookie));
  return redirectResponse;
}

export const config = {
  matcher: ["/resumen/:path*", "/movimientos/:path*", "/grupos/:path*", "/perfil/:path*"],
};