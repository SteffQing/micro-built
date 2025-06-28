// import { NextRequest, NextResponse } from "next/server";
// import { headers } from "next/headers";
// import { auth } from "@/lib/auth";

// export async function middleware(request: NextRequest) {
//   const session = await auth.api.getSession({
//     headers: await headers(),
//   });

//   if (!session) {
//     return NextResponse.redirect(new URL("/sign-in", request.url));
//   }

//   return NextResponse.next();
// }

// export const config = {
//   runtime: "nodejs",
//   matcher: ["/dashboard"], // Apply middleware to specific routes
// };


import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const headers = new Headers(request.headers);
  headers.set("x-current-path", request.nextUrl.pathname);
  return NextResponse.next({ headers });
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};