"use client";

import { useActionState, useState } from "react";

import { FormField } from "@/features/auth/components/form-field";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import { createBusiness } from "../actions";
import { SelectField } from "./fields";
import { LocationPicker } from "./location-picker";

type Option = { slug: string; name: string };
type CityOption = Option & { lat: number; lng: number };

export function CreateBusinessForm({
  cities,
  categories,
}: {
  cities: CityOption[];
  categories: Option[];
}) {
  const [state, action] = useActionState(createBusiness, initialFormState);
  const values = state.values ?? {};
  const errors = state.fieldErrors ?? {};
  const [citySlug, setCitySlug] = useState(values.city || cities[0]?.slug);
  const city = cities.find((item) => item.slug === citySlug) ?? cities[0];
  const initialPoint =
    values.lat && values.lng
      ? { lat: Number(values.lat), lng: Number(values.lng) }
      : null;

  return (
    <form action={action} className="grid gap-6" noValidate>
      <FormMessage state={state} />

      <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card md:p-6">
        <h2 className="text-lg font-semibold">Основни данни</h2>
        <FormField
          name="name"
          label="Име на бизнеса"
          required
          maxLength={120}
          defaultValue={values.name}
          errors={errors.name}
          hint="Както клиентите го познават, напр. „Сервиз Механик“."
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <SelectField
            name="category"
            label="Основна категория"
            defaultValue={values.category}
            errors={errors.category}
          >
            {categories.map((category) => (
              <option key={category.slug} value={category.slug}>
                {category.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            name="city"
            label="Град"
            value={citySlug}
            onChange={(event) => setCitySlug(event.target.value)}
            errors={errors.city}
          >
            {cities.map((item) => (
              <option key={item.slug} value={item.slug}>
                {item.name}
              </option>
            ))}
          </SelectField>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <FormField
            name="phone"
            label="Телефон"
            type="tel"
            autoComplete="tel"
            required
            defaultValue={values.phone}
            errors={errors.phone}
          />
          <FormField
            name="email"
            label="Имейл за клиенти (по желание)"
            type="email"
            defaultValue={values.email}
            errors={errors.email}
          />
        </div>
        <FormField
          name="website"
          label="Уебсайт (по желание)"
          inputMode="url"
          placeholder="example.bg"
          defaultValue={values.website}
          errors={errors.website}
        />
      </section>

      <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card md:p-6">
        <h2 className="text-lg font-semibold">Адрес</h2>
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <FormField
            name="addressLine"
            label="Улица и номер"
            required
            autoComplete="street-address"
            defaultValue={values.addressLine}
            errors={errors.addressLine}
          />
          <FormField
            name="postalCode"
            label="Пощенски код"
            inputMode="numeric"
            autoComplete="postal-code"
            defaultValue={values.postalCode}
            errors={errors.postalCode}
          />
        </div>
        {city && (
          <LocationPicker
            key={city.slug}
            value={city.slug === values.city ? initialPoint : null}
            center={{ lat: city.lat, lng: city.lng }}
            errors={errors.lat ?? errors.lng}
          />
        )}
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <SubmitButton pendingLabel="Създаване…" className="sm:w-auto">
          Създай бизнес профил
        </SubmitButton>
        <p className="text-sm text-muted-foreground">
          Профилът остава чернова, докато не го изпратиш за преглед.
        </p>
      </div>
    </form>
  );
}
