"use client";

import { useActionState } from "react";

import { FormField } from "@/features/auth/components/form-field";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import { updateLocation } from "../actions";
import type { DashboardBusiness } from "../types";
import { TextareaField } from "./fields";
import { LocationPicker } from "./location-picker";

type Location = NonNullable<DashboardBusiness["location"]>;

export function LocationForm({
  business,
  location,
  canEdit,
}: {
  business: DashboardBusiness;
  location: Location;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(
    updateLocation.bind(null, business.id, location.id),
    initialFormState,
  );
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errors = state.fieldErrors ?? {};
  const isRoadside = business.category.kind === "roadside";

  return (
    <form action={action} className="grid gap-6" noValidate>
      <FormMessage state={state} />
      <fieldset disabled={!canEdit} className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <FormField
            name="addressLine"
            label="Улица и номер"
            required
            defaultValue={values.addressLine ?? location.address_line}
            errors={errors.addressLine}
          />
          <FormField
            name="postalCode"
            label="Пощенски код"
            inputMode="numeric"
            defaultValue={values.postalCode ?? location.postal_code ?? ""}
            errors={errors.postalCode}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          Град:{" "}
          <strong className="text-foreground">{business.city.name}</strong>.
          Смяната на града става чрез поддръжката, защото променя адреса на
          профила.
        </p>

        <LocationPicker
          value={{ lat: location.lat, lng: location.lng }}
          center={{ lat: business.city.lat, lng: business.city.lng }}
          errors={errors.lat ?? errors.lng}
        />

        <label className="flex items-start gap-3 text-sm">
          <input
            type="checkbox"
            name="is247"
            defaultChecked={location.is_24_7}
            className="mt-0.5 size-4 accent-primary"
          />
          <span>
            <span className="font-medium">Работим 24/7</span>
            <span className="block text-muted-foreground">
              Отбележи само ако наистина приемате клиенти денонощно.
            </span>
          </span>
        </label>

        {isRoadside ? (
          <>
            <FormField
              name="coverageRadiusKm"
              label="Радиус на обслужване (км)"
              inputMode="decimal"
              defaultValue={
                values.coverageRadiusKm ??
                location.coverage_radius_km?.toString() ??
                ""
              }
              errors={errors.coverageRadiusKm}
              hint="Колко далеч от базата ви изпращате автомобил. Показва се на клиентите."
            />
            <TextareaField
              name="vehicleRestrictions"
              label="Ограничения за превозни средства"
              rows={3}
              maxLength={500}
              defaultValue={
                values.vehicleRestrictions ??
                location.vehicle_restrictions ??
                ""
              }
              errors={errors.vehicleRestrictions}
              hint="Напр. до 3,5 т, без бусове над 6 м."
            />
            <input type="hidden" name="capacity" value={location.capacity} />
          </>
        ) : (
          <FormField
            name="capacity"
            label="Брой работни места (боксове)"
            type="number"
            min={1}
            max={50}
            defaultValue={values.capacity ?? String(location.capacity)}
            errors={errors.capacity}
            hint="Колко клиента можете да обслужвате едновременно. Използва се при онлайн записване."
          />
        )}

        {canEdit && (
          <SubmitButton
            pendingLabel="Запазване…"
            className="sm:w-auto sm:justify-self-start"
          >
            Запази адреса
          </SubmitButton>
        )}
      </fieldset>
    </form>
  );
}
