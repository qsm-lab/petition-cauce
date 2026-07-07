import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const token = request.cookies.get("access_token");
  const { pathname } = request.nextUrl;

  // Admin: require auth
  if (pathname.startsWith("/admin") && !token) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  // Login: redirect to admin if already authed
  if (pathname === "/login" && token) {
    return NextResponse.redirect(new URL("/admin/resumen", request.url));
  }

  // Public campaign pages: pass original host header for campaign resolution
  if (pathname === "/" || pathname.startsWith("/c/") || pathname.startsWith("/aviso-de-privacidad")) {
    const response = NextResponse.next();
    const host =
      request.headers.get("x-forwarded-host") ||
      request.headers.get("host") ||
      "";
    response.headers.set("x-original-host", host);
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/login", "/", "/c/:path*", "/aviso-de-privacidad"],
};
