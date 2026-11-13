"use client";

import { useActionState } from "react";

import { updatePassword } from "../actions";
import { initialFormState } from "../form-state";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function ResetPasswordForm() {
  const [state, action] = useActionState(updatePassword, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="password"
        type="password"
        label="Нова парола"
        autoComplete="new-password"
        required
        hint="Поне 8 символа, с буква и цифра."
        errors={state.fieldErrors?.password}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label="Повтори новата парола"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />
      <SubmitButton pendingLabel="Запазване…">Запази паролата</SubmitButton>
    </form>
  );
}
