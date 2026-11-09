import Link from "next/link";
import { CircleUserRoundIcon, LogInIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/features/auth/session";
import { isSupabaseConfigured } from "@/lib/env/public";

/** Auth-aware header control. Reads cookies, so it renders inside <Suspense>. */
export async function HeaderAccount() {
  if (!isSupabaseConfigured()) return null;
  const user = await getCurrentUser();

  if (user) {
    return (
      <Button asChild variant="ghost-dark" size="sm">
        <Link href="/account" aria-label="Моят профил">
          <CircleUserRoundIcon aria-hidden="true" />
          <span className="hidden sm:inline">Профил</span>
        </Link>
      </Button>
    );
  }

  return (
    <Button asChild variant="ghost-dark" size="sm">
      <Link href="/login">
        <LogInIcon aria-hidden="true" />
        <span className="hidden sm:inline">Вход</span>
        <span className="sr-only sm:hidden">Вход</span>
      </Link>
    </Button>
  );
}
