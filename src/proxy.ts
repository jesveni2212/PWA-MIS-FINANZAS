import { NextResponse, type NextRequest } from "next/server";
import { isPrivatePath } from "@/lib/auth/paths";

export function proxy(request: NextRequest) {
  if (!isPrivatePath(request.nextUrl.pathname)) return NextResponse.next();

  const accessUrl = new URL("/acceso", request.url);
  accessUrl.searchParams.set("next", `${request.nextUrl.pathname}${request.nextUrl.search}`);
  return NextResponse.redirect(accessUrl);
}

export const config = {
  matcher: ["/resumen/:path*", "/movimientos/:path*", "/grupos/:path*", "/perfil/:path*"],
};
