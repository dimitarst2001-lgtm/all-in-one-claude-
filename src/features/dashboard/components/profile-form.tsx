"use client";

import { useActionState } from "react";

import { FormField } from "@/features/auth/components/form-field";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import { updateProfile } from "../actions";
import type { DashboardBusiness } from "../types";
import { TextareaField } from "./fields";

export function ProfileForm({
  business,
  canEdit,
}: {
  business: DashboardBusiness;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(
    updateProfile.bind(null, business.id),
    initialFormState,
  );
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errors = state.fieldErrors ?? {};

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />
      <fieldset disabled={!canEdit} className="grid gap-4">
        <FormField
          name="name"
          label="Име на бизнеса"
          required
          maxLength={120}
          defaultValue={values.name ?? business.name}
          errors={errors.name}
        />
        <TextareaField
          name="description"
          label="Описание"
          rows={6}
          maxLength={5000}
          defaultValue={values.description ?? business.description ?? ""}
          errors={errors.description}
          hint="С какво се занимавате, какви автомобили обслужвате, какво ви отличава."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="phone"
            label="Телефон"
            type="tel"
            defaultValue={values.phone ?? business.phone ?? ""}
            errors={errors.phone}
          />
          <FormField
            name="email"
            label="Имейл за клиенти"
            type="email"
            defaultValue={values.email ?? business.email ?? ""}
            errors={errors.email}
          />
        </div>
        <FormField
          name="website"
          label="Уебсайт"
          inputMode="url"
          defaultValue={values.website ?? business.website ?? ""}
          errors={errors.website}
        />
        {canEdit && (
          <SubmitButton
            pendingLabel="Запазване…"
            className="sm:w-auto sm:justify-self-start"
          >
            Запази
          </SubmitButton>
        )}
      </fieldset>
    </form>
  );
}
