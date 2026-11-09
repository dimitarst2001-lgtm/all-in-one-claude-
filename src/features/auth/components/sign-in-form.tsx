"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn } from "../actions";
import { initialFormState } from "../form-state";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

export function SignInForm({ next }: { next?: string }) {
  const [state, action] = useActionState(signIn, initialFormState);

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <input type="hidden" name="next" value={next ?? ""} />
      <FormField
        name="email"
        type="email"
        label="Имейл"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <div className="grid gap-2">
        <FormField
          name="password"
          type="password"
          label="Парола"
          autoComplete="current-password"
          required
          errors={state.fieldErrors?.password}
        />
        <Link
          href="/forgot-password"
          className="justify-self-end text-sm text-primary hover:underline"
        >
          Забравена парола?
        </Link>
      </div>
      <SubmitButton pendingLabel="Влизане…">Вход</SubmitButton>
    </form>
  );
}
