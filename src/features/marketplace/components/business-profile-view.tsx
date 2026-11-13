import {
  CalendarCheckIcon,
  CarIcon,
  ClockIcon,
  GlobeIcon,
  InfoIcon,
  MailIcon,
  MapPinIcon,
  NavigationIcon,
  PhoneIcon,
  RadarIcon,
  StarIcon,
} from "lucide-react";

import Image from "next/image";

import { Button } from "@/components/ui/button";

import {
  WEEKDAYS,
  businessPath,
  directionsUrl,
  formatDuration,
  formatPriceRange,
  publicMediaUrl,
  telHref,
} from "../format";
import type { BusinessProfile } from "../types";
import { BusinessLogo } from "./business-logo";
import { BusinessMap } from "./business-map";
import { ProfileViewTracker } from "./profile-view-tracker";
import {
  BookingBadge,
  DemoBadge,
  OpenStatusBadge,
  VerifiedBadge,
} from "./status-badges";
import { TrackedLink } from "./tracked-link";

export function BusinessProfileView({ profile }: { profile: BusinessProfile }) {
  const location =
    profile.locations.find((item) => item.is_primary) ?? profile.locations[0];
  const logo = profile.media.find((item) => item.kind === "logo");
  const gallery = profile.media.filter((item) => item.kind !== "logo");
  const isRoadside = profile.category.kind === "roadside";

  return (
    <article aria-labelledby="business-name">
      <ProfileViewTracker businessId={profile.id} />

      {profile.is_demo && (
        <div className="border-b border-warning/40 bg-warning/10">
          <p className="container-page flex items-center gap-2 py-2.5 text-sm">
            <InfoIcon
              className="size-4 shrink-0 text-[#8a5300]"
              aria-hidden="true"
            />
            Това е демо обява, създадена за представяне на платформата. Бизнесът
            не е реален и телефонът не води до истински абонат.
          </p>
        </div>
      )}

      <header className="surface-dark">
        <div className="container-page grid gap-6 py-8 md:grid-cols-[1fr_auto] md:items-end md:py-10">
          <div className="flex gap-4 md:gap-5">
            <BusinessLogo
              name={profile.name}
              path={logo?.path ?? null}
              size={72}
            />
            <div className="min-w-0">
              <p className="text-sm font-medium text-brand">
                {profile.category.name}
              </p>
              <h1
                id="business-name"
                className="mt-1 text-2xl font-semibold text-white md:text-3xl"
              >
                {profile.name}
              </h1>
              {location && (
                <p className="mt-2 flex items-start gap-1.5 text-sm text-navy-muted">
                  <MapPinIcon
                    className="mt-0.5 size-4 shrink-0"
                    aria-hidden="true"
                  />
                  {location.address}
                </p>
              )}
              <div className="mt-3 flex flex-wrap gap-1.5 [&>[data-slot=badge]]:border-transparent [&>[data-slot=badge]]:bg-white">
                {profile.is_demo && <DemoBadge />}
                {profile.is_verified && <VerifiedBadge />}
                {location && (
                  <OpenStatusBadge
                    openNow={location.open_now}
                    is247={location.is_24_7}
                  />
                )}
                {profile.booking_enabled && <BookingBadge />}
                {profile.rating && (
                  <span className="inline-flex items-center gap-1 text-sm text-white">
                    <StarIcon
                      className="size-4 fill-warning text-warning"
                      aria-hidden="true"
                    />
                    {profile.rating.avg.toLocaleString("bg-BG")} (
                    {profile.rating.count} отзива)
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 sm:flex-row md:flex-col lg:flex-row">
            {profile.phone && (
              <Button asChild variant="brand" size="lg">
                <TrackedLink
                  href={telHref(profile.phone)}
                  businessId={profile.id}
                  event="phone_click"
                >
                  <PhoneIcon aria-hidden="true" />
                  {profile.phone}
                </TrackedLink>
              </Button>
            )}
            {location && (
              <Button asChild variant="outline-dark" size="lg">
                <TrackedLink
                  href={directionsUrl(location.lat, location.lng)}
                  target="_blank"
                  rel="noopener noreferrer"
                  businessId={profile.id}
                  event="directions_click"
                >
                  <NavigationIcon aria-hidden="true" />
                  Упътване
                </TrackedLink>
              </Button>
            )}
          </div>
        </div>
      </header>

      <div className="container-page grid gap-8 py-8 md:py-10 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="grid min-w-0 content-start gap-8">
          {profile.description && (
            <ProfileSection id="about" title="За нас">
              <p className="whitespace-pre-line text-muted-foreground">
                {profile.description}
              </p>
            </ProfileSection>
          )}

          <ProfileSection id="services" title="Услуги и цени">
            {profile.services.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Бизнесът все още не е добавил услуги.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border bg-card">
                {profile.services.map((service) => {
                  const price = formatPriceRange(
                    service.price_from_cents,
                    service.price_to_cents,
                  );
                  return (
                    <li
                      key={service.id}
                      className="flex items-start justify-between gap-4 p-4"
                    >
                      <div className="min-w-0">
                        <p className="font-medium">{service.name}</p>
                        {service.description && (
                          <p className="mt-0.5 text-sm text-muted-foreground">
                            {service.description}
                          </p>
                        )}
                        {service.duration_minutes && (
                          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                            <ClockIcon className="size-3" aria-hidden="true" />
                            около {formatDuration(service.duration_minutes)}
                          </p>
                        )}
                      </div>
                      <p className="shrink-0 text-right text-sm font-semibold">
                        {price ?? (
                          <span className="font-normal text-muted-foreground">
                            Цена при запитване
                          </span>
                        )}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
            {profile.services.some(
              (service) => service.price_from_cents !== null,
            ) && (
              <p className="mt-2 text-xs text-muted-foreground">
                Цените са ориентировъчни и се посочват от бизнеса. Окончателната
                цена се уговаря с него.
              </p>
            )}
          </ProfileSection>

          {gallery.length > 0 && (
            <ProfileSection id="gallery" title="Снимки">
              <GalleryGrid name={profile.name} media={gallery} />
            </ProfileSection>
          )}

          {location && (
            <ProfileSection id="location" title="Местоположение">
              <BusinessMap
                markers={[
                  {
                    id: location.id,
                    name: profile.name,
                    lat: location.lat,
                    lng: location.lng,
                    subtitle: location.address,
                  },
                ]}
                center={{ lat: location.lat, lng: location.lng }}
                zoom={15}
                label={`Карта: местоположение на ${profile.name}`}
                className="h-72"
              />
            </ProfileSection>
          )}
        </div>

        <aside
          className="grid content-start gap-4"
          aria-label="Контакти и работно време"
        >
          <InfoCard title="Резервации" icon={CalendarCheckIcon}>
            {profile.booking_enabled && !profile.is_demo ? (
              <div className="grid gap-3">
                <p className="text-sm text-muted-foreground">
                  Избери свободен час онлайн.
                </p>
                <Button asChild className="w-full">
                  <TrackedLink
                    href={`${businessPath(profile.city.slug, profile.slug)}/book`}
                    businessId={profile.id}
                    event="booking_cta"
                  >
                    <CalendarCheckIcon aria-hidden="true" />
                    Запази час
                  </TrackedLink>
                </Button>
              </div>
            ) : profile.booking_enabled ? (
              <p className="text-sm text-muted-foreground">
                Това е демо профил, затова онлайн резервациите не са активни.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Бизнесът не приема онлайн резервации. Свържи се по телефона или
                имейла, за да уговориш час.
              </p>
            )}
          </InfoCard>

          <InfoCard title="Контакти" icon={PhoneIcon}>
            <ul className="grid gap-2.5 text-sm">
              {profile.phone && (
                <li>
                  <TrackedLink
                    href={telHref(profile.phone)}
                    businessId={profile.id}
                    event="phone_click"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <PhoneIcon className="size-4" aria-hidden="true" />
                    {profile.phone}
                  </TrackedLink>
                </li>
              )}
              {profile.email && (
                <li>
                  <TrackedLink
                    href={`mailto:${profile.email}`}
                    businessId={profile.id}
                    event="email_click"
                    className="flex items-center gap-2 break-all text-primary hover:underline"
                  >
                    <MailIcon className="size-4 shrink-0" aria-hidden="true" />
                    {profile.email}
                  </TrackedLink>
                </li>
              )}
              {profile.website && (
                <li>
                  <TrackedLink
                    href={profile.website}
                    target="_blank"
                    rel="noopener noreferrer nofollow"
                    businessId={profile.id}
                    event="website_click"
                    className="flex items-center gap-2 break-all text-primary hover:underline"
                  >
                    <GlobeIcon className="size-4 shrink-0" aria-hidden="true" />
                    {profile.website.replace(/^https?:\/\//, "")}
                  </TrackedLink>
                </li>
              )}
            </ul>
          </InfoCard>

          {location && (
            <InfoCard title="Работно време" icon={ClockIcon}>
              <OpeningHours location={location} />
            </InfoCard>
          )}

          {isRoadside && location && (
            <InfoCard title="Обслужвана зона" icon={RadarIcon}>
              <ul className="grid gap-1.5 text-sm text-muted-foreground">
                {location.coverage_radius_km && (
                  <li>До {location.coverage_radius_km} км от базата</li>
                )}
                {location.service_areas.map((area) => (
                  <li key={area}>{area}</li>
                ))}
              </ul>
              {location.vehicle_restrictions && (
                <p className="mt-3 flex gap-2 text-sm">
                  <CarIcon
                    className="mt-0.5 size-4 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                  {location.vehicle_restrictions}
                </p>
              )}
              <p className="mt-3 text-xs text-muted-foreground">
                Обаждането не е потвърждение на поръчка. Уточни наличност и цена
                директно с фирмата.
              </p>
            </InfoCard>
          )}
        </aside>
      </div>
    </article>
  );
}

function ProfileSection({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-heading`} className="scroll-mt-20">
      <h2 id={`${id}-heading`} className="mb-4 text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

function InfoCard({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border bg-card p-5 shadow-card">
      <h2 className="mb-3 flex items-center gap-2 font-semibold">
        <Icon className="size-4 text-primary" />
        {title}
      </h2>
      {children}
    </section>
  );
}

function OpeningHours({
  location,
}: {
  location: BusinessProfile["locations"][number];
}) {
  if (location.is_24_7)
    return <p className="text-sm">Отворено денонощно, 7 дни в седмицата.</p>;
  if (location.hours.length === 0)
    return (
      <p className="text-sm text-muted-foreground">
        Работното време не е посочено.
      </p>
    );

  return (
    <>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
        {WEEKDAYS.map((day, index) => {
          const intervals = location.hours.filter(
            (hour) => hour.weekday === index + 1,
          );
          return (
            <div key={day} className="contents">
              <dt className="text-muted-foreground">{day}</dt>
              <dd className="text-right tabular-nums">
                {intervals.length === 0
                  ? "Почивен ден"
                  : intervals
                      .map((hour) => `${hour.opens_at}–${hour.closes_at}`)
                      .join(", ")}
              </dd>
            </div>
          );
        })}
      </dl>
      {!location.hours_verified && (
        <p className="mt-3 text-xs text-muted-foreground">
          Работното време не е потвърдено скоро от бизнеса.
        </p>
      )}
    </>
  );
}

function GalleryGrid({
  name,
  media,
}: {
  name: string;
  media: BusinessProfile["media"];
}) {
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {media.map((item) => (
        <li
          key={item.path}
          className="overflow-hidden rounded-md border bg-muted"
        >
          <GalleryImage path={item.path} alt={item.alt ?? `Снимка: ${name}`} />
        </li>
      ))}
    </ul>
  );
}

function GalleryImage({ path, alt }: { path: string; alt: string }) {
  const url = publicMediaUrl(path);
  if (!url) return null;
  return (
    <Image
      src={url}
      alt={alt}
      width={480}
      height={360}
      sizes="(min-width: 640px) 33vw, 50vw"
      className="aspect-[4/3] h-auto w-full object-cover"
    />
  );
}
