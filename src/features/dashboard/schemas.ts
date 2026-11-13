import { z } from "zod";

const optionalText = (max: number, message: string) =>
  z
    .string()
    .trim()
    .max(max, { error: message })
    .optional()
    .transform((value) => (value ? value : null));

/** Accepts Bulgarian numbers in common formats and normalises to +359… */
export const phoneSchema = z
  .string()
  .trim()
  .transform((value) => value.replace(/[\s\-()/.]/g, ""))
  .pipe(
    z
      .string()
      .regex(/^(\+359|00359|0)[1-9]\d{6,9}$/, {
        error: "Въведи български телефонен номер, напр. 0888 123 456.",
      })
      .transform((value) => value.replace(/^(00359|0)/, "+359")),
  );

const optionalPhone = z
  .string()
  .trim()
  .optional()
  .transform((value) => value || undefined)
  .pipe(phoneSchema.optional())
  .transform((value) => value ?? null);

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .optional()
  .transform((value) => value || undefined)
  .pipe(z.email({ error: "Въведи валиден имейл адрес." }).optional())
  .transform((value) => value ?? null);

const optionalWebsite = z
  .string()
  .trim()
  .optional()
  .transform((value) => {
    if (!value) return undefined;
    return /^https?:\/\//i.test(value) ? value : `https://${value}`;
  })
  .pipe(
    z
      .url({
        protocol: /^https?$/,
        error: "Въведи валиден адрес на сайт.",
      })
      .max(300)
      .optional(),
  )
  .transform((value) => value ?? null);

const coordinate = (min: number, max: number) =>
  z
    .string({ error: "Посочи мястото на картата." })
    .trim()
    .min(1, { error: "Посочи мястото на картата." })
    .pipe(
      z.coerce
        .number<string>({ error: "Посочи мястото на картата." })
        .min(min, { error: "Посочи мястото на картата." })
        .max(max, { error: "Посочи мястото на картата." }),
    );

const businessName = z
  .string()
  .trim()
  .min(2, { error: "Въведи име на бизнеса." })
  .max(120, { error: "Името е твърде дълго." });

const addressLine = z
  .string()
  .trim()
  .min(3, { error: "Въведи адрес." })
  .max(200, { error: "Адресът е твърде дълъг." });

const slug = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/);

export const createBusinessSchema = z.object({
  name: businessName,
  city: slug,
  category: slug,
  addressLine,
  postalCode: optionalText(12, "Пощенският код е твърде дълъг."),
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
  phone: phoneSchema,
  email: optionalEmail,
  website: optionalWebsite,
});
export type CreateBusinessInput = z.infer<typeof createBusinessSchema>;

export const profileSchema = z.object({
  name: businessName,
  description: optionalText(5000, "Описанието е твърде дълго."),
  phone: optionalPhone,
  email: optionalEmail,
  website: optionalWebsite,
});

export const locationSchema = z.object({
  addressLine,
  postalCode: optionalText(12, "Пощенският код е твърде дълъг."),
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
  is247: z
    .literal("on")
    .optional()
    .transform((value) => value === "on"),
  coverageRadiusKm: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? Number(value) : null))
    .pipe(
      z
        .number({ error: "Въведи число." })
        .positive({ error: "Радиусът трябва да е положителен." })
        .max(500, { error: "Най-много 500 км." })
        .nullable(),
    ),
  capacity: z.coerce
    .number()
    .int()
    .min(1, { error: "Поне 1." })
    .max(50, { error: "Най-много 50." })
    .default(1),
  vehicleRestrictions: optionalText(500, "Текстът е твърде дълъг."),
});

const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, {
  error: "Невалиден час.",
});

/** Weekly hours as submitted by the hours form (JSON in a hidden field). */
export const hoursSchema = z
  .array(
    z
      .object({
        weekday: z.number().int().min(1).max(7),
        opens_at: time,
        closes_at: time,
      })
      .refine((interval) => interval.opens_at < interval.closes_at, {
        error: "Затварянето трябва да е след отварянето.",
      }),
  )
  .max(28)
  .superRefine((intervals, ctx) => {
    for (let day = 1; day <= 7; day++) {
      const sorted = intervals
        .filter((interval) => interval.weekday === day)
        .sort((a, b) => a.opens_at.localeCompare(b.opens_at));
      for (let i = 1; i < sorted.length; i++) {
        if (sorted[i].opens_at < sorted[i - 1].closes_at) {
          ctx.addIssue({
            code: "custom",
            message: "Интервалите в един ден не трябва да се застъпват.",
          });
          return;
        }
      }
    }
  });

const euroToCents = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? Number(value.replace(",", ".")) : null))
  .pipe(
    z
      .number({ error: "Въведи цена в евро." })
      .min(0, { error: "Цената не може да е отрицателна." })
      .max(100000, { error: "Цената е твърде висока." })
      .nullable(),
  )
  .transform((value) => (value === null ? null : Math.round(value * 100)));

export const serviceSchema = z
  .object({
    id: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    serviceTypeId: z
      .uuid()
      .optional()
      .or(z.literal("").transform(() => undefined)),
    name: z
      .string()
      .trim()
      .min(2, { error: "Въведи име на услугата." })
      .max(120, { error: "Името е твърде дълго." }),
    description: optionalText(1000, "Описанието е твърде дълго."),
    priceFrom: euroToCents,
    priceTo: euroToCents,
    durationMinutes: z
      .string()
      .trim()
      .optional()
      .transform((value) => (value ? Number(value) : null))
      .pipe(
        z
          .number({ error: "Въведи минути." })
          .int({ error: "Въведи цяло число минути." })
          .min(5, { error: "Поне 5 минути." })
          .max(1440, { error: "Най-много 24 часа." })
          .nullable(),
      ),
    isActive: z
      .literal("on")
      .optional()
      .transform((value) => value === "on"),
    isBookable: z
      .literal("on")
      .optional()
      .transform((value) => value === "on"),
  })
  .refine(
    (service) => !service.isBookable || service.durationMinutes !== null,
    {
      error: "За онлайн записване въведи времетраене.",
      path: ["durationMinutes"],
    },
  )
  .refine(
    (service) =>
      service.priceFrom === null ||
      service.priceTo === null ||
      service.priceTo >= service.priceFrom,
    { error: "Крайната цена трябва да е по-голяма.", path: ["priceTo"] },
  );

export const inviteSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .pipe(z.email("Въведи валиден имейл адрес.").max(254)),
  role: z.enum(["staff", "manager"], "Избери роля."),
});
