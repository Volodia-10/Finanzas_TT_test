import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME } from "@/lib/constants";
import { verifyToken } from "@/lib/token";

const protectedPrefixes = ["/ingresos", "/egresos", "/transferencias", "/saldos", "/admin"];

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const token = request.cookies.get(COOKIE_NAME)?.value;
  const session = token ? await verifyToken(token) : null;

  const isProtected = protectedPrefixes.some((prefix) => pathname.startsWith(prefix));

  if (isProtected && !session) {
    const loginUrl = new URL("/login", request.url);
    return NextResponse.redirect(loginUrl);
  }

  if (pathname.startsWith("/admin") && session?.role !== "ADMIN") {
    const incomesUrl = new URL("/ingresos", request.url);
    return NextResponse.redirect(incomesUrl);
  }

  if (pathname === "/login" && session) {
    const incomesUrl = new URL("/ingresos", request.url);
    return NextResponse.redirect(incomesUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/ingresos/:path*", "/egresos/:path*", "/transferencias/:path*", "/saldos/:path*", "/admin/:path*"]
};
