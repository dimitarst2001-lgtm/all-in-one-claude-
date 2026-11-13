"use client";

import { Trash2Icon } from "lucide-react";
import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormField } from "@/features/auth/components/form-field";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import { addBlockedDays, removeBlockedDays } from "../actions";
import type { BlockedDay } from "../types";

const dayFormat = new Intl.DateTimeFormat("bg-BG", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

function formatDay(isoDate: string) {
  return dayFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

function BlockedRow({
  businessId,
  item,
  canEdit,
}: {
  businessId: string;
  item: BlockedDay;
  canEdit: boolean;
}) {
  const [state, remove, pending] = useActionState(
    removeBlockedDays.bind(null, businessId, item.id),
    initialFormState,
  );
  return (
    <li className="flex flex-wrap items-center gap-3 py-3 first:pt-0 last:pb-0">
      <div className="min-w-0 flex-1 text-sm">
        <p className="font-medium">
          {item.from === item.to
            ? formatDay(item.from)
            : `${formatDay(item.from)} – ${formatDay(item.to)}`}
        </p>
        {item.reason && <p className="text-muted-foreground">{item.reason}</p>}
      </div>
      {canEdit && (
        <form action={remove}>
          <Button
            type="submit"
            size="sm"
            variant="ghost"
            disabled={pending}
            className="text-destructive hover:text-destructive"
          >
            <Trash2Icon aria-hidden="true" />
            Премахни
          </Button>
        </form>
      )}
      {state.status === "error" && <FormMessage state={state} />}
    </li>
  );
}

export function BlockedDaysManager({
  businessId,
  items,
  today,
  canEdit,
}: {
  businessId: string;
  items: BlockedDay[];
  today: string;
  canEdit: boolean;
}) {
  const [state, action] = useActionState(
    addBlockedDays.bind(null, businessId),
    initialFormState,
  );
  const values = state.status === "error" ? (state.values ?? {}) : {};
  const errors = state.fieldErrors ?? {};

  return (
    <section className="grid gap-4 rounded-lg border bg-card p-5 shadow-card">
      <div>
        <h3 className="font-semibold">Почивни дни</h3>
        <p className="text-sm text-muted-foreground">
          В тези дни не се предлагат часове за резервация.
        </p>
      </div>
      {items.length > 0 ? (
        <ul className="divide-y">
          {items.map((item) => (
            <BlockedRow
              key={item.id}
              businessId={businessId}
              item={item}
              canEdit={canEdit}
            />
          ))}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">Няма въведени.</p>
      )}
      {canEdit && (
        <form action={action} noValidate className="grid gap-4">
          <FormMessage state={state} />
          <div className="grid grid-cols-2 gap-4">
            <FormField
              name="from"
              type="date"
              label="От"
              min={today}
              defaultValue={values.from ?? today}
              errors={errors.from}
            />
            <FormField
              name="to"
              type="date"
              label="До (включително)"
              min={today}
              defaultValue={values.to ?? today}
              errors={errors.to}
            />
            <div className="col-span-2">
              <FormField
                name="reason"
                label="Бележка (по желание)"
                maxLength={200}
                defaultValue={values.reason}
                errors={errors.reason}
              />
            </div>
          </div>
          <SubmitButton pendingLabel="Добавяне…" className="w-fit">
            Добави почивни дни
          </SubmitButton>
        </form>
      )}
    </section>
  );
}
