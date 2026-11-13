import { z } from "zod";

export type FormState = {
  status: "idle" | "success" | "error";
  message?: string;
  fieldErrors?: Record<string, string[] | undefined>;
  /** Echo of non-secret inputs so the form keeps them after a failed submit. */
  values?: Record<string, string>;
};

export const initialFormState: FormState = { status: "idle" };

export function validationError(
  error: z.ZodError,
  values?: Record<string, string>,
): FormState {
  return {
    status: "error",
    message: "Провери въведените данни.",
    fieldErrors: z.flattenError(error).fieldErrors as Record<
      string,
      string[] | undefined
    >,
    values,
  };
}

/** Reads string fields from FormData; files and missing keys become undefined. */
export function formValues<K extends string>(
  formData: FormData,
  keys: readonly K[],
): Record<K, string | undefined> {
  return Object.fromEntries(
    keys.map((key) => {
      const value = formData.get(key);
      return [key, typeof value === "string" ? value : undefined];
    }),
  ) as Record<K, string | undefined>;
}
