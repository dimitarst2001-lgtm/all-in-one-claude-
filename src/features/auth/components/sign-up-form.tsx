"use client";

import Link from "next/link";
import { BuildingIcon, UserIcon } from "lucide-react";
import { useActionState, useState } from "react";

import { cn } from "@/lib/utils";

import { signUp } from "../actions";
import { initialFormState } from "../form-state";
import type { AccountType } from "../schemas";
import { FormField } from "./form-field";
import { FormMessage } from "./form-message";
import { SubmitButton } from "./submit-button";

const accountOptions: {
  value: AccountType;
  label: string;
  description: string;
  icon: typeof UserIcon;
}[] = [
  {
    value: "customer",
    label: "Шофьор",
    description: "Търся услуги за колата си",
    icon: UserIcon,
  },
  {
    value: "business",
    label: "Бизнес",
    description: "Предлагам автомобилни услуги",
    icon: BuildingIcon,
  },
];

export function SignUpForm({
  defaultAccountType = "customer",
}: {
  defaultAccountType?: AccountType;
}) {
  const [state, action] = useActionState(signUp, initialFormState);
  const [accountType, setAccountType] = useState<AccountType>(
    (state.values?.accountType as AccountType | undefined) ??
      defaultAccountType,
  );

  if (state.status === "success") {
    return <FormMessage state={state} />;
  }

  return (
    <form action={action} className="grid gap-4" noValidate>
      <FormMessage state={state} />

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Тип акаунт</legend>
        <div className="grid grid-cols-2 gap-2">
          {accountOptions.map(({ value, label, description, icon: Icon }) => (
            <label
              key={value}
              className={cn(
                "flex cursor-pointer flex-col gap-1 rounded-md border p-3 text-sm transition-colors has-[:focus-visible]:ring-[3px] has-[:focus-visible]:ring-ring/40",
                accountType === value
                  ? "border-primary bg-accent"
                  : "hover:bg-muted",
              )}
            >
              <input
                type="radio"
                name="accountType"
                value={value}
                checked={accountType === value}
                onChange={() => setAccountType(value)}
                className="sr-only"
              />
              <span className="flex items-center gap-2 font-medium">
                <Icon className="size-4 text-primary" aria-hidden="true" />
                {label}
              </span>
              <span className="text-xs text-muted-foreground">
                {description}
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      <FormField
        name="fullName"
        label={accountType === "business" ? "Име на управителя" : "Име"}
        autoComplete="name"
        required
        defaultValue={state.values?.fullName}
        errors={state.fieldErrors?.fullName}
      />
      <FormField
        name="email"
        type="email"
        label="Имейл"
        autoComplete="email"
        required
        defaultValue={state.values?.email}
        errors={state.fieldErrors?.email}
      />
      <FormField
        name="password"
        type="password"
        label="Парола"
        autoComplete="new-password"
        required
        hint="Поне 8 символа, с буква и цифра."
        errors={state.fieldErrors?.password}
      />
      <FormField
        name="confirmPassword"
        type="password"
        label="Повтори паролата"
        autoComplete="new-password"
        required
        errors={state.fieldErrors?.confirmPassword}
      />

      <div className="grid gap-1.5">
        <label className="flex items-start gap-2.5 text-sm">
          <input
            type="checkbox"
            name="acceptTerms"
            required
            aria-invalid={Boolean(state.fieldErrors?.acceptTerms) || undefined}
            aria-describedby={
              state.fieldErrors?.acceptTerms ? "acceptTerms-error" : undefined
            }
            className="mt-0.5 size-4 accent-[#1565C0]"
          />
          <span>
            Приемам{" "}
            <Link
              href="/terms"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
            >
              общите условия
            </Link>{" "}
            и съм запознат(а) с{" "}
            <Link
              href="/privacy"
              className="text-primary underline-offset-4 hover:underline"
              target="_blank"
            >
              политиката за поверителност
            </Link>
            .
          </span>
        </label>
        {state.fieldErrors?.acceptTerms && (
          <p id="acceptTerms-error" className="text-sm text-destructive">
            {state.fieldErrors.acceptTerms[0]}
          </p>
        )}
      </div>

      <SubmitButton pendingLabel="Създаване…">Създай акаунт</SubmitButton>
    </form>
  );
}
