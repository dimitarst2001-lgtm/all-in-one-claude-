"use server";

import { createHash, randomBytes } from "node:crypto";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import {
  formValues,
  validationError,
  type FormState,
} from "@/features/auth/form-state";
import { getCurrentUser } from "@/features/auth/session";
import { escapeHtml, sendEmail } from "@/lib/email/send";
import { siteUrl } from "@/lib/env/public";
import { getRateLimiter } from "@/lib/security/rate-limit";

import { authed, fail, NOT_SIGNED_IN } from "./action-helpers";
import { getDashboardBusiness } from "./queries";
import { inviteSchema } from "./schemas";
import { roleLabels } from "./types";

/**
 * Team actions. Who may invite, change roles or remove people is decided by
 * RLS on business_invitations / business_members; plan limits by triggers.
 */

export type InviteState = FormState & {
  /** Shown once so the inviter can pass it on when no e-mail was sent. */
  inviteUrl?: string;
  emailed?: boolean;
};

export async function inviteMember(
  businessId: string,
  _prev: InviteState,
  formData: FormData,
): Promise<InviteState> {
  if (!z.uuid().safeParse(businessId).success) return NOT_SIGNED_IN;
  const raw = formValues(formData, ["email", "role"]);
  const values = { email: raw.email ?? "", role: raw.role ?? "" };
  const parsed = inviteSchema.safeParse(raw);
  if (!parsed.success) return validationError(parsed.error, values);

  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;
  const limit = await getRateLimiter().hit(`invite:${user.id}`, 20, 3600);
  if (!limit.allowed) {
    return {
      status: "error",
      message: "Твърде много покани. Опитай отново по-късно.",
      values,
    };
  }

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const result: InviteState = await authed(async (supabase) => {
    const { error } = await supabase.from("business_invitations").insert({
      business_id: businessId,
      email: parsed.data.email,
      role: parsed.data.role,
      token_hash: tokenHash,
      invited_by: user.id,
    });
    if (error) return fail(error, values);
    return { status: "success" };
  });
  if (result.status !== "success") return result;

  const business = await getDashboardBusiness(businessId);
  const inviteUrl = `${siteUrl}/invitations/${token}`;
  const businessName = business?.name ?? "бизнес профил";
  const roleName = roleLabels[parsed.data.role].toLowerCase();
  const emailed = await sendEmail({
    to: parsed.data.email,
    subject: `Покана за екипа на ${businessName} в All in One Auto`,
    text: `Поканен си като ${roleName} в ${businessName}.\n\nПриеми поканата: ${inviteUrl}\n\nЛинкът важи 7 дни.`,
    html: `<p>Поканен си като <strong>${escapeHtml(roleName)}</strong> в <strong>${escapeHtml(businessName)}</strong>.</p><p><a href="${escapeHtml(inviteUrl)}">Приеми поканата</a></p><p>Линкът важи 7 дни.</p>`,
  });

  refresh();
  return {
    status: "success",
    message: emailed
      ? `Поканата е изпратена до ${parsed.data.email}.`
      : "Поканата е създадена. Изпрати линка на човека, когото каниш.",
    inviteUrl: emailed ? undefined : inviteUrl,
    emailed,
  };
}

export async function revokeInvitation(
  businessId: string,
  invitationId: string,
  _prev: FormState,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.uuid().safeParse(invitationId).success
  ) {
    return NOT_SIGNED_IN;
  }
  return authed(async (supabase) => {
    const { data, error } = await supabase
      .from("business_invitations")
      .update({ revoked_at: new Date().toISOString() })
      .eq("id", invitationId)
      .eq("business_id", businessId)
      .is("accepted_at", null)
      .select("id");
    if (error) return fail(error);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    refresh();
    return { status: "success", message: "Поканата е отменена." };
  });
}

export async function changeMemberRole(
  businessId: string,
  userId: string,
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const role = z.enum(["staff", "manager"]).safeParse(formData.get("role"));
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.guid().safeParse(userId).success ||
    !role.success
  ) {
    return NOT_SIGNED_IN;
  }
  return authed(async (supabase) => {
    const { data, error } = await supabase
      .from("business_members")
      .update({ role: role.data })
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) return fail(error);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    refresh();
    return { status: "success", message: "Ролята е променена." };
  });
}

export async function removeMember(
  businessId: string,
  userId: string,
  _prev: FormState,
): Promise<FormState> {
  if (
    !z.uuid().safeParse(businessId).success ||
    !z.guid().safeParse(userId).success
  ) {
    return NOT_SIGNED_IN;
  }
  const user = await getCurrentUser();
  if (!user) return NOT_SIGNED_IN;

  const result = await authed(async (supabase) => {
    const { data, error } = await supabase
      .from("business_members")
      .delete()
      .eq("business_id", businessId)
      .eq("user_id", userId)
      .select("user_id");
    if (error) return fail(error);
    if (!data?.length)
      return { status: "error", message: "Нямаш права за това действие." };
    return { status: "success", message: "Членът е премахнат от екипа." };
  });

  // Leaving a business: its dashboard is no longer accessible.
  if (result.status === "success" && userId === user.id) redirect("/dashboard");
  refresh();
  return result;
}

export async function acceptInvitation(
  token: string,
  _prev: FormState,
): Promise<FormState> {
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(token)) {
    return { status: "error", message: "Невалидна покана." };
  }
  let businessId: string | null = null;
  const result = await authed(async (supabase) => {
    const { data, error } = await supabase.rpc("accept_business_invitation", {
      p_token: token,
    });
    if (error) return fail(error);
    businessId = z.uuid().parse(data);
    return { status: "success" };
  });
  if (businessId) redirect(`/dashboard/${businessId}?joined=1`);
  return result;
}
