"use client";

import { useActionState } from "react";

import { requestPasswordReset } from "../actions";
import { initialFormState } from "../form-state";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function ForgotPasswordForm() {
  const [state, action] = useActionState(
    requestPasswordReset,
    initialFormState,
  );

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <FormField
        name="email"
        type="email"
        label="Имейл"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <SubmitButton pendingLabel="Изпращане…">Изпрати линк</SubmitButton>
    </form>
  );
}
