"use client";

import { PencilIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { FormField } from "@/features/auth/components/form-field";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";
import {
  formatDuration,
  formatPriceRange,
} from "@/features/marketplace/format";

import { deleteService, saveService } from "../actions";
import type { DashboardBusiness, DashboardService } from "../types";
import { SelectField, TextareaField } from "./fields";

const centsToInput = (cents: number | null) =>
  cents === null ? "" : (cents / 100).toString();

function ServiceForm({
  businessId,
  service,
  serviceTypes,
  onDone,
}: {
  businessId: string;
  service: DashboardService | null;
  serviceTypes: DashboardBusiness["service_types"];
  onDone: () => void;
}) {
  const [state, action] = useActionState(
    async (prev: Parameters<typeof saveService>[1], formData: FormData) => {
      const result = await saveService(businessId, prev, formData);
      if (result.status === "success") onDone();
      return result;
    },
    initialFormState,
  );
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errors = state.fieldErrors ?? {};

  return (
    <form
      action={action}
      className="grid gap-4 rounded-lg border bg-card p-5 shadow-card"
      noValidate
    >
      <h3 className="font-semibold">
        {service ? "Редакция на услуга" : "Нова услуга"}
      </h3>
      <FormMessage state={state} />
      <input type="hidden" name="id" value={service?.id ?? ""} />
      {serviceTypes.length > 0 && (
        <SelectField
          name="serviceTypeId"
          label="Вид услуга (за търсенето)"
          defaultValue={values.serviceTypeId ?? service?.service_id ?? ""}
          hint="Свързването с вид услуга помага клиентите да те намерят при търсене."
        >
          <option value="">Друго</option>
          {serviceTypes.map((type) => (
            <option key={type.id} value={type.id}>
              {type.name}
            </option>
          ))}
        </SelectField>
      )}
      <FormField
        name="name"
        label="Име"
        required
        maxLength={120}
        defaultValue={values.name ?? service?.name}
        errors={errors.name}
      />
      <TextareaField
        name="description"
        label="Описание (по желание)"
        rows={3}
        maxLength={1000}
        defaultValue={values.description ?? service?.description ?? ""}
        errors={errors.description}
      />
      <div className="grid gap-4 sm:grid-cols-3">
        <FormField
          name="priceFrom"
          label="Цена от (€)"
          inputMode="decimal"
          defaultValue={
            values.priceFrom ?? centsToInput(service?.price_from_cents ?? null)
          }
          errors={errors.priceFrom}
        />
        <FormField
          name="priceTo"
          label="Цена до (€)"
          inputMode="decimal"
          defaultValue={
            values.priceTo ?? centsToInput(service?.price_to_cents ?? null)
          }
          errors={errors.priceTo}
        />
        <FormField
          name="durationMinutes"
          label="Времетраене (мин)"
          inputMode="numeric"
          defaultValue={
            values.durationMinutes ??
            service?.duration_minutes?.toString() ??
            ""
          }
          errors={errors.durationMinutes}
        />
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={service?.is_active ?? true}
          className="size-4 accent-primary"
        />
        Показвай услугата в профила
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          name="isBookable"
          defaultChecked={service?.is_bookable ?? false}
          className="size-4 accent-primary"
        />
        Може да се запази час онлайн (нужно е времетраене)
      </label>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingLabel="Запазване…" className="w-auto">
          {service ? "Запази" : "Добави услугата"}
        </SubmitButton>
        <Button type="button" variant="ghost" onClick={onDone}>
          Отказ
        </Button>
      </div>
    </form>
  );
}

function DeleteServiceButton({
  businessId,
  service,
}: {
  businessId: string;
  service: DashboardService;
}) {
  const [state, action, pending] = useActionState(
    deleteService.bind(null, businessId, service.id),
    initialFormState,
  );
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (!window.confirm(`Да премахна ли „${service.name}“?`)) {
          event.preventDefault();
        }
      }}
    >
      <Button
        type="submit"
        variant="ghost"
        size="icon"
        disabled={pending}
        aria-label={`Премахни ${service.name}`}
      >
        <Trash2Icon aria-hidden="true" />
      </Button>
      {state.status === "error" && (
        <p role="alert" className="text-sm text-destructive">
          {state.message}
        </p>
      )}
    </form>
  );
}

export function ServicesManager({
  business,
  canEdit,
}: {
  business: DashboardBusiness;
  canEdit: boolean;
}) {
  const [editing, setEditing] = useState<DashboardService | "new" | null>(null);
  const limit = business.limits.max_services;
  const used = business.services.length;
  const atLimit = limit !== null && used >= limit;

  return (
    <div className="grid gap-4">
      <p className="text-sm text-muted-foreground">
        {limit === null
          ? `${used} услуги · без ограничение`
          : `${used} от ${limit} услуги според плана`}
      </p>

      {business.services.length === 0 ? (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Все още няма добавени услуги. Добави поне една, за да изпратиш профила
          за преглед.
        </p>
      ) : (
        <ul className="divide-y rounded-lg border bg-card">
          {business.services.map((service) => {
            const price = formatPriceRange(
              service.price_from_cents,
              service.price_to_cents,
            );
            return (
              <li key={service.id} className="flex items-start gap-3 p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">
                    {service.name}{" "}
                    {!service.is_active && (
                      <Badge variant="secondary">Скрита</Badge>
                    )}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {[
                      price ?? "Цена при запитване",
                      service.duration_minutes &&
                        formatDuration(service.duration_minutes),
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Редактирай ${service.name}`}
                      onClick={() => setEditing(service)}
                    >
                      <PencilIcon aria-hidden="true" />
                    </Button>
                    <DeleteServiceButton
                      businessId={business.id}
                      service={service}
                    />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {canEdit &&
        (editing ? (
          <ServiceForm
            key={editing === "new" ? "new" : editing.id}
            businessId={business.id}
            service={editing === "new" ? null : editing}
            serviceTypes={business.service_types}
            onDone={() => setEditing(null)}
          />
        ) : (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              type="button"
              onClick={() => setEditing("new")}
              disabled={atLimit}
            >
              <PlusIcon aria-hidden="true" />
              Добави услуга
            </Button>
            {atLimit && (
              <p className="text-sm text-muted-foreground">
                Достигна лимита на плана си.
              </p>
            )}
          </div>
        ))}
    </div>
  );
}
