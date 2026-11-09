import type { Metadata } from "next";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ResetPasswordForm } from "@/features/auth/components/reset-password-form";

export const metadata: Metadata = {
  title: "Нова парола",
  robots: { index: false },
};

/** Reached from the recovery e-mail via /auth/confirm, which establishes the session. */
export default function ResetPasswordPage() {
  return (
    <AuthCard
      title="Нова парола"
      description="Избери нова парола за акаунта си."
    >
      <ResetPasswordForm />
    </AuthCard>
  );
}
