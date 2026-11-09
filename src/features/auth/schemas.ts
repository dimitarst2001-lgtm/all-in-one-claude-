import { z } from "zod";

const email = z
  .string()
  .trim()
  .toLowerCase()
  .max(254, { error: "Имейлът е твърде дълъг." })
  .pipe(z.email({ error: "Въведи валиден имейл адрес." }));

export const passwordSchema = z
  .string()
  .min(8, { error: "Паролата трябва да е поне 8 символа." })
  .max(72, { error: "Паролата трябва да е най-много 72 символа." })
  .regex(/[A-Za-zА-Яа-я]/, {
    error: "Паролата трябва да съдържа поне една буква.",
  })
  .regex(/\d/, { error: "Паролата трябва да съдържа поне една цифра." });

export const signInSchema = z.object({
  email,
  password: z.string().min(1, { error: "Въведи парола." }).max(72),
  next: z.string().optional(),
});

export const accountTypes = ["customer", "business"] as const;
export type AccountType = (typeof accountTypes)[number];

export const signUpSchema = z
  .object({
    accountType: z.enum(accountTypes).default("customer"),
    fullName: z
      .string()
      .trim()
      .min(2, { error: "Въведи име." })
      .max(120, { error: "Името е твърде дълго." }),
    email,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: z.literal("on", {
      error: "Трябва да приемеш общите условия.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "Паролите не съвпадат.",
  });

export const forgotPasswordSchema = z.object({ email });

export const updatePasswordSchema = z
  .object({ password: passwordSchema, confirmPassword: z.string() })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "Паролите не съвпадат.",
  });
