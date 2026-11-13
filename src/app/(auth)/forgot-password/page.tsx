import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { ForgotPasswordForm } from "@/features/auth/components/forgot-password-form";

export const metadata: Metadata = {
  title: "Забравена парола",
  robots: { index: false },
};

export default function ForgotPasswordPage() {
  return (
    <AuthCard
      title="Забравена парола"
      description="Въведи имейла си и ще ти изпратим линк за нова парола."
      footer={
        <Link
          href="/login"
          className="font-medium text-primary hover:underline"
        >
          Обратно към вход
        </Link>
      }
    >
      <ForgotPasswordForm />
    </AuthCard>
  );
}
