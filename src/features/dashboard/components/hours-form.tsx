"use client";

import { CopyIcon, PlusIcon, Trash2Icon } from "lucide-react";
import { useActionState, useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";
import { WEEKDAYS } from "@/features/marketplace/format";

import { saveHours } from "../actions";
import type { HoursInterval } from "../types";

type Interval = { opens_at: string; closes_at: string };
type Week = Record<number, Interval[]>;

function toWeek(hours: HoursInterval[]): Week {
  const week: Week = { 1: [], 2: [], 3: [], 4: [], 5: [], 6: [], 7: [] };
  for (const { weekday, opens_at, closes_at } of hours) {
    week[weekday].push({ opens_at, closes_at });
  }
  return week;
}

export function HoursForm({
  businessId,
  locationId,
  hours,
  canEdit,
}: {
  businessId: string;
  locationId: string;
  hours: HoursInterval[];
  canEdit: boolean;
}) {
  const [state, action] = useActionState(
    saveHours.bind(null, businessId, locationId),
    initialFormState,
  );
  const [week, setWeek] = useState<Week>(() => toWeek(hours));

  const payload = Object.entries(week).flatMap(([day, intervals]) =>
    intervals.map((interval) => ({ weekday: Number(day), ...interval })),
  );

  function update(day: number, next: Interval[]) {
    setWeek((current) => ({ ...current, [day]: next }));
  }

  function copyMondayToWeekdays() {
    setWeek((current) => ({
      ...current,
      2: [...current[1]],
      3: [...current[1]],
      4: [...current[1]],
      5: [...current[1]],
    }));
  }

  return (
    <form action={action} className="grid gap-4">
      <FormMessage state={state} />
      <input type="hidden" name="hours" value={JSON.stringify(payload)} />

      <fieldset disabled={!canEdit} className="grid gap-3">
        <legend className="sr-only">Работно време по дни</legend>
        {WEEKDAYS.map((label, index) => {
          const day = index + 1;
          const intervals = week[day];
          const closed = intervals.length === 0;
          return (
            <div
              key={day}
              className="grid gap-3 rounded-md border bg-card p-3 sm:grid-cols-[9rem_1fr] sm:items-start"
            >
              <div className="flex items-center justify-between gap-2 sm:block">
                <p className="font-medium">{label}</p>
                <label className="flex items-center gap-2 text-sm text-muted-foreground sm:mt-1">
                  <input
                    type="checkbox"
                    checked={closed}
                    onChange={(event) =>
                      update(
                        day,
                        event.target.checked
                          ? []
                          : [{ opens_at: "09:00", closes_at: "18:00" }],
                      )
                    }
                    className="size-4 accent-primary"
                  />
                  Почивен ден
                </label>
              </div>
              {!closed && (
                <div className="grid gap-2">
                  {intervals.map((interval, position) => (
                    <div
                      key={position}
                      className="flex flex-wrap items-center gap-2"
                    >
                      <Input
                        type="time"
                        aria-label={`${label}: отваря`}
                        value={interval.opens_at}
                        onChange={(event) =>
                          update(
                            day,
                            intervals.map((item, i) =>
                              i === position
                                ? { ...item, opens_at: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="w-32"
                        required
                      />
                      <span aria-hidden="true">–</span>
                      <Input
                        type="time"
                        aria-label={`${label}: затваря`}
                        value={interval.closes_at}
                        onChange={(event) =>
                          update(
                            day,
                            intervals.map((item, i) =>
                              i === position
                                ? { ...item, closes_at: event.target.value }
                                : item,
                            ),
                          )
                        }
                        className="w-32"
                        required
                      />
                      {intervals.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`Премахни интервала за ${label}`}
                          onClick={() =>
                            update(
                              day,
                              intervals.filter((_, i) => i !== position),
                            )
                          }
                        >
                          <Trash2Icon aria-hidden="true" />
                        </Button>
                      )}
                    </div>
                  ))}
                  {intervals.length < 4 && (
                    <Button
                      type="button"
                      variant="link"
                      size="sm"
                      className="justify-self-start px-0"
                      onClick={() =>
                        update(day, [
                          ...intervals,
                          { opens_at: "13:00", closes_at: "18:00" },
                        ])
                      }
                    >
                      <PlusIcon aria-hidden="true" />
                      Добави интервал (напр. след обедна почивка)
                    </Button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </fieldset>

      {canEdit && (
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <SubmitButton pendingLabel="Запазване…" className="sm:w-auto">
            Запази работното време
          </SubmitButton>
          <Button
            type="button"
            variant="outline"
            onClick={copyMondayToWeekdays}
          >
            <CopyIcon aria-hidden="true" />
            Копирай понеделник за вторник–петък
          </Button>
        </div>
      )}
      <p className="text-sm text-muted-foreground">
        С запазването потвърждаваш, че часовете са актуални. Само тогава
        клиентите виждат „Отворено сега“.
      </p>
    </form>
  );
}
