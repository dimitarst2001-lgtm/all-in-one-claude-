import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

import {
  isSupabaseConfigured,
  requireSupabasePublicConfig,
} from "@/lib/env/public";

const PRIVATE_PREFIXES = ["/account", "/dashboard", "/admin"] as const;

/**
 * Refreshes the Supabase auth session on every matched request and writes the
 * updated cookies to both the request (for Server Components) and response.
 *
 * This is an optimistic layer only; authorization is always re-checked on the
 * server next to the data (see ARCHITECTURE.md ADR-003).
 */
export async function updateSupabaseSession(
  request: NextRequest,
): Promise<NextResponse> {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const { url, publishableKey } = requireSupabasePublicConfig();

  const supabase = createServerClient(url, publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
        // Prevent CDNs from caching a response that carries a session cookie.
        for (const [key, value] of Object.entries(headers)) {
          response.headers.set(key, value);
        }
      },
    },
  });

  // Do not run code between createServerClient and getClaims(): it validates
  // the JWT and triggers the refresh that keeps the session alive.
  const { data } = await supabase.auth.getClaims();

  // Optimistic gate for private areas. The real authorization check happens
  // again next to the data (DAL + RLS); this only avoids rendering a page
  // shell for anonymous visitors.
  const { pathname, search } = request.nextUrl;
  const isPrivate = PRIVATE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
  if (isPrivate && !data?.claims?.sub) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    loginUrl.search = `?next=${encodeURIComponent(pathname + search)}`;
    const redirect = NextResponse.redirect(loginUrl);
    for (const cookie of response.cookies.getAll())
      redirect.cookies.set(cookie);
    return redirect;
  }

  return response;
}
