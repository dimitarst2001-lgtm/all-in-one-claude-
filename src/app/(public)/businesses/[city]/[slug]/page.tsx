import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { Breadcrumbs, JsonLd } from "@/components/layout/breadcrumbs";
import { BusinessProfileView } from "@/features/marketplace/components/business-profile-view";
import { businessPath, inCity } from "@/features/marketplace/format";
import {
  getBusinessPaths,
  getBusinessProfile,
} from "@/features/marketplace/queries";
import { businessJsonLd } from "@/features/marketplace/structured-data";

/**
 * Prerender known public profiles; new ones render on first request and are
 * then cached. Cache Components requires at least one param, so when the
 * database is unreachable at build time a sentinel is returned that
 * resolves to notFound().
 */
export async function generateStaticParams() {
  const paths = await getBusinessPaths().catch(() => []);
  const params = paths.slice(0, 500).map(({ city, slug }) => ({ city, slug }));
  return params.length > 0 ? params : [{ city: "varna", slug: "__none__" }];
}

export async function generateMetadata({
  params,
}: PageProps<"/businesses/[city]/[slug]">): Promise<Metadata> {
  const { city, slug } = await params;
  const profile = await getBusinessProfile(city, slug);
  if (!profile)
    return { title: "Бизнесът не е намерен", robots: { index: false } };

  const title = `${profile.name} — ${profile.category.name} ${inCity(profile.city.name)}`;
  const description =
    profile.description?.slice(0, 155) ??
    `${profile.category.name} ${inCity(profile.city.name)}: адрес, телефон, работно време и услуги.`;
  const path = businessPath(profile.city.slug, profile.slug);

  return {
    title,
    description,
    alternates: { canonical: path },
    // Demo listings are not real businesses and must not be indexed.
    robots: profile.is_demo ? { index: false, follow: true } : undefined,
    openGraph: { type: "website", title, description, url: path },
  };
}

export default async function BusinessProfilePage({
  params,
}: PageProps<"/businesses/[city]/[slug]">) {
  const { city, slug } = await params;
  const profile = await getBusinessProfile(city, slug);
  if (!profile) notFound();

  const jsonLd = businessJsonLd(profile);

  return (
    <>
      <div className="border-b bg-card">
        <div className="container-page py-3">
          <Breadcrumbs
            items={[
              { name: "Начало", href: "/" },
              { name: profile.city.name, href: `/${profile.city.slug}` },
              {
                name: profile.category.name,
                href: `/${profile.city.slug}/${profile.category.slug}`,
              },
              {
                name: profile.name,
                href: businessPath(profile.city.slug, profile.slug),
              },
            ]}
          />
        </div>
      </div>
      <BusinessProfileView profile={profile} />
      {jsonLd && <JsonLd data={jsonLd} />}
    </>
  );
}
