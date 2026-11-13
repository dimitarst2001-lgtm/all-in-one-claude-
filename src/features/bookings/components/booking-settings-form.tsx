"use client";

import { useActionState } from "react";

import { FormField } from "@/features/auth/components/form-field";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";
import { SelectField } from "@/features/dashboard/components/fields";

import { saveBookingSettings } from "../actions";
import type { BookingSettings } from "../queries";
import { slotLengths } from "../schemas";

export function BookingSettingsForm({
  businessId,
  settings,
  hasFeature,
  canEdit,
}: {
  businessId: string;
  settings: BookingSettings;
  hasFeature: boolean;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(
    saveBookingSettings.bind(null, businessId),
    initialFormState,
  );
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      noValidate
      className="grid gap-4 rounded-lg border bg-card p-5 shadow-card"
    >
      <div>
        <h3 className="font-semibold">Настройки</h3>
        <p className="text-sm text-muted-foreground">
          Свободните часове следват работното време и капацитета (броя места) от
          „Адрес“.
        </p>
      </div>
      <FormMessage state={state} />
      {!hasFeature && (
        <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">
          Онлайн записването е включено в плановете Professional и Premium.
          Можеш да подготвиш настройките сега и да го включиш след избор на
          план.
        </p>
      )}
      <fieldset disabled={!canEdit} className="grid gap-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <input
            type="checkbox"
            name="enabled"
            defaultChecked={settings.booking_enabled}
            disabled={!hasFeature && !settings.booking_enabled}
            className="size-4 accent-primary"
          />
          Приемам онлайн резервации
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="autoConfirm"
            defaultChecked={settings.booking_auto_confirm}
            className="size-4 accent-primary"
          />
          Потвърждавай резервациите автоматично
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="slotMinutes"
            label="Стъпка между часовете"
            defaultValue={
              values.slotMinutes ?? String(settings.booking_slot_minutes)
            }
            errors={errors.slotMinutes}
          >
            {slotLengths.map((minutes) => (
              <option key={minutes} value={minutes}>
                {minutes} мин
              </option>
            ))}
          </SelectField>
          <FormField
            name="bufferMinutes"
            label="Почивка след всеки час (мин)"
            inputMode="numeric"
            defaultValue={
              values.bufferMinutes ?? String(settings.booking_buffer_minutes)
            }
            errors={errors.bufferMinutes}
          />
          <FormField
            name="leadHours"
            label="Най-рано след (часа)"
            inputMode="numeric"
            hint="Колко часа напред трябва да се запише клиентът."
            defaultValue={
              values.leadHours ?? String(settings.booking_lead_hours)
            }
            errors={errors.leadHours}
          />
          <FormField
            name="horizonDays"
            label="Най-късно до (дни напред)"
            inputMode="numeric"
            defaultValue={
              values.horizonDays ?? String(settings.booking_horizon_days)
            }
            errors={errors.horizonDays}
          />
        </div>
      </fieldset>
      {canEdit && (
        <SubmitButton pendingLabel="Запазване…" className="w-fit">
          Запази настройките
        </SubmitButton>
      )}
    </form>
  );
}
