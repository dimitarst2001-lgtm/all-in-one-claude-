import type { Metadata } from "next";
import Link from "next/link";

import { AuthCard } from "@/features/auth/components/auth-card";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Невалиден линк",
  robots: { index: false },
};

export default function AuthErrorPage() {
  return (
    <AuthCard
      title="Линкът е невалиден или е изтекъл"
      description="Линковете за потвърждение и смяна на парола важат ограничено време и могат да се използват само веднъж."
    >
      <div className="flex flex-col gap-3">
        <Button asChild>
          <Link href="/forgot-password">Поискай нов линк за парола</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/login">Към вход</Link>
        </Button>
      </div>
    </AuthCard>
  );
}
