import type { Metadata } from "next";
import Link from "next/link";
import {
  CircleCheckIcon,
  CircleIcon,
  EyeIcon,
  GlobeIcon,
  NavigationIcon,
  PhoneIcon,
} from "lucide-react";

import { SubmitReviewForm } from "@/features/dashboard/components/submit-review-form";
import { loadDashboardBusiness } from "@/features/dashboard/load";
import { setupSteps } from "@/features/dashboard/types";

export const metadata: Metadata = {
  title: "Табло",
  robots: { index: false },
};

const statLabels = [
  { key: "profile_view", label: "Прегледа на профила", icon: EyeIcon },
  { key: "phone_click", label: "Обаждания", icon: PhoneIcon },
  { key: "directions_click", label: "Упътвания", icon: NavigationIcon },
  { key: "website_click", label: "Посещения на сайта", icon: GlobeIcon },
] as const;

export default async function BusinessOverviewPage({
  params,
  searchParams,
}: PageProps<"/dashboard/[businessId]">) {
  const { businessId } = await params;
  const { created } = await searchParams;
  const { business, canEdit } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}`,
  );
  const steps = setupSteps(business);
  const ready = steps.every((step) => step.done);
  const canSubmit =
    canEdit && (business.status === "draft" || business.status === "rejected");

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
      <div className="grid content-start gap-6">
        {created === "1" && (
          <p
            role="status"
            className="rounded-md border border-success/30 bg-success/5 p-3 text-sm text-success"
          >
            Бизнес профилът е създаден като чернова.
          </p>
        )}

        {business.status === "rejected" && business.rejection_reason && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"
          >
            <p className="font-medium text-destructive">Профилът е отхвърлен</p>
            <p className="mt-1">{business.rejection_reason}</p>
            <p className="mt-2 text-muted-foreground">
              Направи нужните корекции и го изпрати отново.
            </p>
          </div>
        )}
        {business.status === "suspended" && (
          <div
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm"
          >
            Профилът е спрян от модератор и не се показва публично. Свържи се с
            поддръжката за подробности.
          </div>
        )}

        <section className="rounded-lg border bg-card p-5 shadow-card md:p-6">
          <h2 className="text-lg font-semibold">Готовност на профила</h2>
          <ul className="mt-4 grid gap-2">
            {steps.map((step) => (
              <li key={step.key}>
                <Link
                  href={step.href}
                  className="flex items-center gap-3 rounded-md p-2 text-sm hover:bg-muted"
                >
                  {step.done ? (
                    <CircleCheckIcon
                      className="size-5 text-success"
                      aria-hidden="true"
                    />
                  ) : (
                    <CircleIcon
                      className="size-5 text-muted-foreground"
                      aria-hidden="true"
                    />
                  )}
                  <span className={step.done ? "" : "font-medium"}>
                    {step.label}
                  </span>
                  <span className="sr-only">
                    {step.done ? "(готово)" : "(предстои)"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          {canSubmit && (
            <div className="mt-5 border-t pt-5">
              <SubmitReviewForm businessId={business.id} ready={ready} />
            </div>
          )}
          {business.status === "pending_review" && (
            <p className="mt-5 border-t pt-5 text-sm text-muted-foreground">
              Профилът чака преглед от модератор. Можеш да продължиш да го
              редактираш междувременно.
            </p>
          )}
        </section>

        <section className="rounded-lg border bg-card p-5 shadow-card md:p-6">
          <h2 className="text-lg font-semibold">Последните 30 дни</h2>
          {business.is_public ? (
            <dl className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
              {statLabels.map(({ key, label, icon: Icon }) => (
                <div key={key} className="rounded-md bg-muted p-3">
                  <dt className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Icon className="size-3.5" aria-hidden="true" />
                    {label}
                  </dt>
                  <dd className="mt-1 text-2xl font-semibold tabular-nums">
                    {business.stats_30d[key]}
                  </dd>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Статистиката започва да се събира, когато профилът стане публичен.
            </p>
          )}
        </section>
      </div>

      <aside className="grid content-start gap-4">
        <section className="rounded-lg border bg-card p-5 shadow-card">
          <h2 className="font-semibold">Абонамент</h2>
          {business.plan ? (
            <p className="mt-2 text-sm">
              Активен план: <strong>{business.plan.name}</strong>
            </p>
          ) : (
            <p className="mt-2 text-sm text-muted-foreground">
              Нямаш активен абонамент. Профилът става публичен след одобрение и
              активен абонамент. Плащанията се включват скоро; дотогава
              подготвяш профила в рамките на плана Starter.
            </p>
          )}
          <Link
            href="/for-businesses#plans"
            className="mt-3 inline-block text-sm font-medium text-primary hover:underline"
          >
            Сравни плановете
          </Link>
        </section>
      </aside>
    </div>
  );
}
