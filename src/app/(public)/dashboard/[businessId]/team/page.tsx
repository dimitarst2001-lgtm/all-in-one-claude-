import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TeamManager } from "@/features/dashboard/components/team-manager";
import { loadDashboardBusiness } from "@/features/dashboard/load";
import { getBusinessTeam } from "@/features/dashboard/queries";
import { getSupabaseServerClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Екип", robots: { index: false } };
// Private, per-user view: rendered on demand inside the layout's Suspense
// boundary rather than as an instant-navigation shell.
export const instant = false;

export default async function BusinessTeamPage({
  params,
}: PageProps<"/dashboard/[businessId]/team">) {
  const { businessId } = await params;
  const { business } = await loadDashboardBusiness(
    businessId,
    `/dashboard/${businessId}/team`,
  );
  const supabase = await getSupabaseServerClient();
  const [team, { data: maxMembers }] = await Promise.all([
    getBusinessTeam(business.id),
    supabase.rpc("business_feature_limit", {
      p_business_id: business.id,
      p_feature: "max_team_members",
    }),
  ]);
  if (!team || !business.role) notFound();

  return (
    <section className="max-w-3xl">
      <h2 className="mb-1 text-xl font-semibold">Екип</h2>
      <p className="mb-4 text-sm text-muted-foreground">
        Покани колеги, които да управляват профила заедно с теб.
      </p>
      <TeamManager
        businessId={business.id}
        team={team}
        myRole={business.role}
        maxMembers={typeof maxMembers === "number" ? maxMembers : null}
      />
    </section>
  );
}
