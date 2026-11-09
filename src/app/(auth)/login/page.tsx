import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";

import { AuthCard } from "@/features/auth/components/auth-card";
import { SignInForm } from "@/features/auth/components/sign-in-form";
import { Skeleton } from "@/components/ui/skeleton";

export const metadata: Metadata = {
  title: "Вход",
  robots: { index: false },
  alternates: { canonical: "/login" },
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <AuthCard
      title="Вход"
      description="Влез в акаунта си, за да управляваш резервации и бизнес профили."
      footer={
        <>
          Нямаш акаунт?{" "}
          <Link
            href="/register"
            className="font-medium text-primary hover:underline"
          >
            Регистрирай се
          </Link>
        </>
      }
    >
      <Suspense fallback={<FormSkeleton />}>
        <SignInFormWithNext searchParams={searchParams} />
      </Suspense>
    </AuthCard>
  );
}

async function SignInFormWithNext({
  searchParams,
}: Pick<PageProps<"/login">, "searchParams">) {
  const { next } = await searchParams;
  return <SignInForm next={typeof next === "string" ? next : undefined} />;
}

function FormSkeleton() {
  return (
    <div className="grid gap-4" aria-hidden="true">
      <Skeleton className="h-16" />
      <Skeleton className="h-16" />
      <Skeleton className="h-10" />
    </div>
  );
}
