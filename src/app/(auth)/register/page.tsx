import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/features/auth/components/auth-card";
import { SignUpForm } from "@/features/auth/components/sign-up-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Регистрация",
  description: "Създай безплатен акаунт в All in One Auto.",
  alternates: { canonical: "/register" },
};

export default function RegisterPage({ searchParams }: PageProps<"/register">) {
  return (
    <AuthCard
      title="Създай акаунт"
      description="Безплатно за шофьори. Бизнесите избират абонамент след одобрение на профила."
      footer={
        <>
          Вече имаш акаунт?{" "}
          <Link
            href="/login"
            className="font-medium text-primary hover:underline"
          >
            Вход
          </Link>
        </>
      }
    >
      <Suspense fallback={<Skeleton className="h-96" />}>
        <SignUpFormWithType searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignUpFormWithType({
  searchParams,
}: Pick<PageProps<"/register">, "searchParams">) {
  const { type } = await searchParams;
  return (
    <SignUpForm
      defaultAccountType={type === "business" ? "business" : "customer"}
    />
  );
}
