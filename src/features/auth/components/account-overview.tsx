import Link from "next/link";
import {
  CalendarCheckIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  PlusIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

import { signOut } from "../actions";
import { requireUser } from "../session";

const roleLabels = {
  moderator: "Модератор",
  super_admin: "Администратор",
} as const;

type AccountOverviewProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export async function AccountOverview({ searchParams }: AccountOverviewProps) {
  const user = await requireUser("/account");
  const params = await searchParams;

  return (
    <div className="grid max-w-2xl gap-6">
      {params.password === "updated" && (
        <p
          role="status"
          className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success"
        >
          Паролата е сменена успешно.
        </p>
      )}
      {params.welcome === "business" && (
        <div
          role="status"
          className="rounded-md border bg-accent/60 p-4 text-sm"
        >
          <p className="font-medium">Добре дошъл! Акаунтът ти е потвърден.</p>
          <p className="mt-1 text-muted-foreground">
            Следващата стъпка е да създадеш бизнес профила си.
          </p>
          <Button asChild size="sm" className="mt-3">
            <Link href="/dashboard/new">
              <PlusIcon aria-hidden="true" />
              Създай бизнес профил
            </Link>
          </Button>
        </div>
      )}

      <section
        aria-labelledby="account-bookings"
        className="rounded-lg border bg-card p-6 shadow-card"
      >
        <h2 id="account-bookings" className="text-lg font-semibold">
          Моите резервации
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Виж статуса на записаните часове или отмени резервация.
        </p>
        <Button asChild variant="outline" className="mt-4">
          <Link href="/account/bookings">
            <CalendarCheckIcon aria-hidden="true" />
            Към резервациите
          </Link>
        </Button>
      </section>

      <section
        aria-labelledby="account-businesses"
        className="rounded-lg border bg-card p-6 shadow-card"
      >
        <h2 id="account-businesses" className="text-lg font-semibold">
          Моите бизнеси
        </h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Управлявай профила, услугите, снимките и екипа на бизнеса си от
          таблото.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button asChild>
            <Link href="/dashboard">
              <LayoutDashboardIcon aria-hidden="true" />
              Към таблото
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link href="/dashboard/new">
              <PlusIcon aria-hidden="true" />
              Добави бизнес
            </Link>
          </Button>
        </div>
      </section>

      <section
        aria-labelledby="account-details"
        className="rounded-lg border bg-card p-6 shadow-card"
      >
        <h2 id="account-details" className="text-lg font-semibold">
          Данни за акаунта
        </h2>
        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-[10rem_1fr]">
          <dt className="text-muted-foreground">Име</dt>
          <dd>{user.fullName ?? "—"}</dd>
          <dt className="text-muted-foreground">Имейл</dt>
          <dd>{user.email}</dd>
          {user.platformRoles.length > 0 && (
            <>
              <dt className="text-muted-foreground">Роли</dt>
              <dd className="flex flex-wrap gap-1.5">
                {user.platformRoles.map((role) => (
                  <Badge key={role}>
                    <ShieldCheckIcon aria-hidden="true" />
                    {roleLabels[role]}
                  </Badge>
                ))}
              </dd>
            </>
          )}
        </dl>
        <form action={signOut} className="mt-6">
          <Button type="submit" variant="outline">
            <LogOutIcon aria-hidden="true" />
            Изход
          </Button>
        </form>
      </section>
    </div>
  );
}
