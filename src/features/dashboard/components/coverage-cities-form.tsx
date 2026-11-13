"use client";

import { useActionState } from "react";

import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import { saveCoverageCities } from "../actions";

export function CoverageCitiesForm({
  businessId,
  locationId,
  cities,
  selected,
  canEdit,
}: {
  businessId: string;
  locationId: string;
  cities: { slug: string; name: string }[];
  selected: string[];
  canEdit: boolean;
}) {
  const [state, action] = useActionState(
    saveCoverageCities.bind(null, businessId, locationId),
    initialFormState,
  );

  return (
    <form
      action={action}
      className="grid gap-4 rounded-lg border bg-card p-5 shadow-card"
    >
      <div>
        <h3 className="font-semibold">Градове, които обслужвате изцяло</h3>
        <p className="text-sm text-muted-foreground">
          Освен радиуса около базата, клиентите в тези градове също ще ви виждат
          в „Пътна помощ“. Отбележи само места, до които наистина изпращате
          автомобил.
        </p>
      </div>
      <FormMessage state={state} />
      <fieldset disabled={!canEdit} className="grid gap-2 sm:grid-cols-2">
        <legend className="sr-only">Градове</legend>
        {cities.map((city) => (
          <label key={city.slug} className="flex items-center gap-3 text-sm">
            <input
              type="checkbox"
              name="cities"
              value={city.slug}
              defaultChecked={selected.includes(city.slug)}
              className="size-4 accent-primary"
            />
            {city.name}
          </label>
        ))}
      </fieldset>
      {canEdit && (
        <SubmitButton pendingLabel="Запазване…" className="w-fit">
          Запази градовете
        </SubmitButton>
      )}
    </form>
  );
}
