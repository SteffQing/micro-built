import { NextResponse, type NextRequest } from "next/server";

const API_ORIGIN = process.env.API_ORIGIN ?? "http://localhost:3003";
const EDGE_PROXY_SECRET = process.env.EDGE_PROXY_SECRET ?? "";

export function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;

  // Auth routes: rewrite to the API with edge headers so the backend sees
  // the real client IP and can apply rate limits.
  if (pathname.startsWith("/api/auth/")) {
    const headers = new Headers(request.headers);
    headers.set("x-mb-edge", EDGE_PROXY_SECRET);

    const forwarded = request.headers.get("x-forwarded-for");
    const clientIp = forwarded?.split(",")[0]?.trim() ?? request.headers.get("x-real-ip") ?? "";
    if (clientIp) {
      headers.set("x-mb-client-ip", clientIp);
    }

    return NextResponse.rewrite(new URL(pathname + search, API_ORIGIN), {
      request: { headers },
    });
  }

  // Page routes: set x-current-path for the app to read.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-current-path", pathname);

  // Optimistic session-based redirects (UX hint only).
  // Production cookies are `__Secure-` prefixed (secure cookies), dev ones are not.
  const hasSession =
    request.cookies.get("__Secure-better-auth.session_token") ??
    request.cookies.get("better-auth.session_token");
  const isAuthPage =
    pathname === "/login" ||
    pathname === "/sign-up" ||
    pathname === "/verify-code" ||
    pathname === "/forgot-password" ||
    pathname === "/reset-password" ||
    pathname === "/two-factor";

  // `expired` comes from the API client after a 401: the cookie is stale, so don't send them back to the
  // dashboard (which would 401 again and loop).
  const sessionExpired = request.nextUrl.searchParams.has("expired");

  if (hasSession && isAuthPage && !sessionExpired) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  const isPublicPage = pathname === "/" || pathname.startsWith("/about");
  if (!hasSession && !isPublicPage && !isAuthPage && !pathname.startsWith("/api/")) {
    const next = encodeURIComponent(pathname);
    return NextResponse.redirect(new URL(`/login?next=${next}`, request.url));
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|monitoring|icon|apple-icon|.*\\..*).*)"],
};
