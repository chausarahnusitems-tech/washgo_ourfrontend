import { createServerClient } from "@supabase/ssr";
import { NextResponse } from "next/server";

// Refreshes the Supabase auth session on every request so server components and
// route handlers see a valid token. No route gating — access is progressive
// (the app is fully usable signed-out; auth only persists data per user).
export async function middleware(request) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        }
      }
    }
  );

  // Touch the user to trigger a token refresh when needed. Do not run code
  // between client creation and this call (per Supabase SSR guidance).
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run on all paths except static assets, image files, and the OAuth callback.
  // The callback exchanges the PKCE code CLIENT-SIDE and then full-reloads to its
  // destination (where this middleware runs normally), so there's no server-side
  // session to refresh on that request — skip it.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|auth/callback|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"
  ]
};
