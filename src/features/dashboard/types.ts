import { z } from "zod";

export const businessStatusSchema = z.enum([
  "draft",
  "pending_review",
  "approved",
  "rejected",
  "suspended",
]);
export type BusinessStatus = z.infer<typeof businessStatusSchema>;

export const businessRoleSchema = z.enum(["staff", "manager", "owner"]);
export type BusinessRole = z.infer<typeof businessRoleSchema>;

export const myBusinessSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: businessStatusSchema,
  role: businessRoleSchema,
  city: z.object({ slug: z.string(), name: z.string() }),
  category: z.string(),
});
export type MyBusiness = z.infer<typeof myBusinessSchema>;

export const hoursIntervalSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  opens_at: z.string(),
  closes_at: z.string(),
});
export type HoursInterval = z.infer<typeof hoursIntervalSchema>;

export const dashboardServiceSchema = z.object({
  id: z.uuid(),
  service_id: z.uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  price_from_cents: z.number().nullable(),
  price_to_cents: z.number().nullable(),
  duration_minutes: z.number().nullable(),
  is_bookable: z.boolean(),
  is_active: z.boolean(),
});
export type DashboardService = z.infer<typeof dashboardServiceSchema>;

export const dashboardBusinessSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  slug: z.string(),
  status: businessStatusSchema,
  rejection_reason: z.string().nullable(),
  is_verified: z.boolean(),
  is_demo: z.boolean(),
  description: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  booking_enabled: z.boolean(),
  role: businessRoleSchema.nullable(),
  is_public: z.boolean(),
  city: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    lat: z.number(),
    lng: z.number(),
  }),
  category: z.object({
    id: z.uuid(),
    slug: z.string(),
    name: z.string(),
    kind: z.enum(["business", "roadside"]),
  }),
  plan: z.object({ code: z.string(), name: z.string() }).nullable(),
  limits: z.object({
    max_services: z.number().nullable(),
    max_images: z.number().nullable(),
    online_booking: z.boolean(),
  }),
  location: z
    .object({
      id: z.uuid(),
      address_line: z.string(),
      postal_code: z.string().nullable(),
      lat: z.number(),
      lng: z.number(),
      is_24_7: z.boolean(),
      coverage_radius_km: z.coerce.number().nullable(),
      capacity: z.number(),
      vehicle_restrictions: z.string().nullable(),
      hours_verified_at: z.string().nullable(),
      hours: z.array(hoursIntervalSchema),
    })
    .nullable(),
  services: z.array(dashboardServiceSchema),
  service_types: z.array(z.object({ id: z.uuid(), name: z.string() })),
  stats_30d: z.object({
    profile_view: z.number(),
    phone_click: z.number(),
    website_click: z.number(),
    directions_click: z.number(),
  }),
});
export type DashboardBusiness = z.infer<typeof dashboardBusinessSchema>;

export const statusLabels: Record<BusinessStatus, string> = {
  draft: "Чернова",
  pending_review: "Чака одобрение",
  approved: "Одобрен",
  rejected: "Отхвърлен",
  suspended: "Спрян",
};

export const roleLabels: Record<BusinessRole, string> = {
  owner: "Собственик",
  manager: "Мениджър",
  staff: "Служител",
};

/** Role hierarchy check that mirrors has_business_role() in the database. */
export function hasRole(role: BusinessRole | null, min: BusinessRole): boolean {
  const order: BusinessRole[] = ["staff", "manager", "owner"];
  return role !== null && order.indexOf(role) >= order.indexOf(min);
}

export type SetupStep = {
  key: "profile" | "location" | "hours" | "services";
  label: string;
  done: boolean;
  href: string;
};

/** What a business still has to fill in before submitting for review. */
export function setupSteps(business: DashboardBusiness): SetupStep[] {
  const base = `/dashboard/${business.id}`;
  return [
    {
      key: "profile",
      label: "Описание и телефон",
      done: Boolean(business.description && business.phone),
      href: `${base}/profile`,
    },
    {
      key: "location",
      label: "Адрес и точка на картата",
      done: business.location !== null,
      href: `${base}/location`,
    },
    {
      key: "hours",
      label: "Работно време",
      done:
        business.location !== null &&
        (business.location.is_24_7 || business.location.hours.length > 0),
      href: `${base}/hours`,
    },
    {
      key: "services",
      label: "Поне една услуга",
      done: business.services.some((service) => service.is_active),
      href: `${base}/services`,
    },
  ];
}

// Photos ------------------------------------------------------------------------

export const mediaKindSchema = z.enum(["logo", "cover", "gallery"]);
export type MediaKind = z.infer<typeof mediaKindSchema>;

export const dashboardMediaSchema = z.object({
  id: z.uuid(),
  kind: mediaKindSchema,
  storage_path: z.string(),
  alt_text: z.string().nullable(),
  width: z.number().nullable(),
  height: z.number().nullable(),
  sort_order: z.number(),
});
export type DashboardMedia = z.infer<typeof dashboardMediaSchema>;

// Team --------------------------------------------------------------------------

export const teamSchema = z.object({
  members: z.array(
    z.object({
      user_id: z.guid(),
      role: businessRoleSchema,
      full_name: z.string().nullable(),
      email: z.string().nullable(),
      joined_at: z.string().nullable(),
      is_self: z.boolean(),
    }),
  ),
  invitations: z.array(
    z.object({
      id: z.uuid(),
      email: z.string(),
      role: businessRoleSchema,
      expires_at: z.string(),
      created_at: z.string(),
      is_expired: z.boolean(),
    }),
  ),
});
export type BusinessTeam = z.infer<typeof teamSchema>;

export const invitationPreviewSchema = z.object({
  business_id: z.uuid(),
  business_name: z.string(),
  role: businessRoleSchema,
  email: z.string(),
  status: z.enum(["open", "accepted", "revoked", "expired"]),
  email_matches: z.boolean(),
});
export type InvitationPreview = z.infer<typeof invitationPreviewSchema>;
