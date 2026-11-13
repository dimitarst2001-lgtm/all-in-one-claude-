import "server-only";

import { serverEnv } from "@/lib/env/server";

export type EmailMessage = {
  to: string;
  subject: string;
  text: string;
  html: string;
};

/**
 * Sends a transactional e-mail through Resend's HTTP API. Returns false when
 * Resend is not configured or the request fails, so callers can fall back
 * (for example by showing a link to copy) instead of failing the action.
 */
export async function sendEmail(message: EmailMessage): Promise<boolean> {
  const apiKey = serverEnv.RESEND_API_KEY;
  const from = serverEnv.EMAIL_FROM;
  if (!apiKey || !from) return false;

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from, ...message, to: [message.to] }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!response.ok) {
      console.error("[email] Resend responded with", response.status);
      return false;
    }
    return true;
  } catch (error) {
    console.error("[email] send failed", error);
    return false;
  }
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
