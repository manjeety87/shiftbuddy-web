import { NextResponse, type NextRequest } from "next/server";
import { SIGNED_IN_COOKIE } from "@/lib/sessionMarker";

// Runs before a page renders. A visitor who isn't signed in never gets the app's
// pages (they go to /login), and a signed-in one never sees the login pages again.
//
// This is the first of three checks, and the least trusted one — it reads a hint
// cookie, so it only decides which page to show:
//   1. here: redirect before anything renders;
//   2. `AppShell`: the real session (a token refresh) must succeed, or it sends you out;
//   3. the backend: every data route verifies the access token and scopes by user.
const AUTH_PAGES = ["/login", "/register", "/forgot-password"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isSignedIn = request.cookies.has(SIGNED_IN_COOKIE);
  const isAuthPage = AUTH_PAGES.some((page) => pathname === page || pathname.startsWith(`${page}/`));

  if (isAuthPage) return isSignedIn ? NextResponse.redirect(new URL("/home", request.url)) : NextResponse.next();
  return isSignedIn ? NextResponse.next() : NextResponse.redirect(new URL("/login", request.url));
}

export const config = {
  // Pages only: not the API (the backend guards itself), Next's own files, or anything with a file extension
  matcher: ["/((?!api|_next/static|_next/image|.*\\..*).*)"],
};
