import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";

import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { getSupabaseServerClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

/**
 * Landing endpoint for links in Supabase Auth e-mails (sign-up confirmation,
 * password recovery, e-mail change). Supports both the recommended
 * `token_hash` templates and the PKCE `code` flow, then redirects to a
 * same-origin `next` path.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"), "/account");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");

  const failure = NextResponse.redirect(new URL("/auth/error", request.url));

  try {
    const supabase = await getSupabaseServerClient();

    if (tokenHash && type && OTP_TYPES.includes(type)) {
      const { error } = await supabase.auth.verifyOtp({
        type,
        token_hash: tokenHash,
      });
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    } else if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) return NextResponse.redirect(new URL(next, request.url));
    }
  } catch (error) {
    console.error("[auth/confirm]", error);
  }

  return failure;
}
