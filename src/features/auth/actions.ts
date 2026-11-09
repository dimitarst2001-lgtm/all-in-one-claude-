"use server";

import { redirect } from "next/navigation";

import { MissingConfigError, siteUrl } from "@/lib/env/public";
import { getClientIp } from "@/lib/security/client-ip";
import { getRateLimiter, rateLimits } from "@/lib/security/rate-limit";
import { safeRedirectPath } from "@/lib/security/safe-redirect";
import { getSupabaseServerClient } from "@/lib/supabase/server";

import { authErrorMessage } from "./error-messages";
import { formValues, validationError, type FormState } from "./form-state";
import {
  forgotPasswordSchema,
  signInSchema,
  signUpSchema,
  updatePasswordSchema,
} from "./schemas";

const UNAVAILABLE: FormState = {
  status: "error",
  message: "Входът временно не е наличен. Опитай отново по-късно.",
};

const RATE_LIMITED: FormState = {
  status: "error",
  message: "Твърде много опити. Опитай отново след малко.",
};

async function withSupabase<T>(
  run: (
    supabase: Awaited<ReturnType<typeof getSupabaseServerClient>>,
  ) => Promise<T>,
) {
  try {
    return await run(await getSupabaseServerClient());
  } catch (error) {
    if (error instanceof MissingConfigError) return UNAVAILABLE;
    throw error;
  }
}

async function isRateLimited(
  action: keyof typeof rateLimits,
  discriminator = "",
): Promise<boolean> {
  const { limit, windowSeconds } = rateLimits[action];
  const ip = await getClientIp();
  const result = await getRateLimiter().hit(
    `${action}:${ip}:${discriminator}`,
    limit,
    windowSeconds,
  );
  return !result.allowed;
}

export async function signIn(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData, ["email", "password", "next"]);
  const parsed = signInSchema.safeParse(raw);
  if (!parsed.success)
    return validationError(parsed.error, { email: raw.email ?? "" });

  if (await isRateLimited("signIn", parsed.data.email)) return RATE_LIMITED;

  const result = await withSupabase(async (supabase) => {
    const { error } = await supabase.auth.signInWithPassword({
      email: parsed.data.email,
      password: parsed.data.password,
    });
    if (error) {
      return {
        status: "error",
        message: authErrorMessage(error),
        values: { email: parsed.data.email },
      } as FormState;
    }
    return null;
  });

  if (result) return result;
  redirect(safeRedirectPath(parsed.data.next));
}

export async function signUp(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData, [
    "accountType",
    "fullName",
    "email",
    "password",
    "confirmPassword",
    "acceptTerms",
  ]);
  const echo = {
    accountType: raw.accountType ?? "customer",
    fullName: raw.fullName ?? "",
    email: raw.email ?? "",
  };
  const parsed = signUpSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, echo);

  if (await isRateLimited("signUp")) return RATE_LIMITED;

  const next =
    parsed.data.accountType === "business"
      ? "/account?welcome=business"
      : "/account?welcome=1";

  return withSupabase(async (supabase) => {
    const { error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent(next)}`,
        // Descriptive only. Privileges are never derived from user metadata.
        data: {
          full_name: parsed.data.fullName,
          signup_intent: parsed.data.accountType,
          terms_accepted_at: new Date().toISOString(),
        },
      },
    });

    if (error)
      return {
        status: "error",
        message: authErrorMessage(error),
        values: echo,
      } as FormState;

    // Same response whether or not the address already has an account, so
    // the form cannot be used to discover registered e-mails.
    return {
      status: "success",
      message: `Изпратихме линк за потвърждение на ${parsed.data.email}. Отвори го, за да активираш акаунта си.`,
    } as FormState;
  });
}

export async function requestPasswordReset(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const raw = formValues(formData, ["email"]);
  const parsed = forgotPasswordSchema.safeParse(raw);
  if (!parsed.success)
    return validationError(parsed.error, { email: raw.email ?? "" });

  if (await isRateLimited("passwordReset")) return RATE_LIMITED;

  return withSupabase(async (supabase) => {
    const { error } = await supabase.auth.resetPasswordForEmail(
      parsed.data.email,
      {
        redirectTo: `${siteUrl}/auth/confirm?next=${encodeURIComponent("/reset-password")}`,
      },
    );
    if (error && error.code !== "user_not_found") {
      if (error.code?.startsWith("over_")) return RATE_LIMITED;
      console.error("[auth] password reset failed", error.code);
    }
    return {
      status: "success",
      message:
        "Ако има акаунт с този имейл, ще получиш линк за нова парола до няколко минути.",
    } as FormState;
  });
}

export async function updatePassword(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = updatePasswordSchema.safeParse(
    formValues(formData, ["password", "confirmPassword"]),
  );
  if (!parsed.success) return validationError(parsed.error);

  const result = await withSupabase(async (supabase) => {
    const { data } = await supabase.auth.getClaims();
    if (!data?.claims?.sub) {
      return {
        status: "error",
        message: "Линкът за смяна на паролата е изтекъл. Поискай нов.",
      } as FormState;
    }
    const { error } = await supabase.auth.updateUser({
      password: parsed.data.password,
    });
    if (error)
      return { status: "error", message: authErrorMessage(error) } as FormState;
    return null;
  });

  if (result) return result;
  redirect("/account?password=updated");
}

export async function signOut(): Promise<void> {
  try {
    const supabase = await getSupabaseServerClient();
    await supabase.auth.signOut();
  } catch (error) {
    if (!(error instanceof MissingConfigError)) throw error;
  }
  redirect("/");
}
