"use client";

import { useActionState } from "react";

import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import { submitForReview } from "../actions";

export function SubmitReviewForm({
  businessId,
  ready,
}: {
  businessId: string;
  ready: boolean;
}) {
  const [state, action] = useActionState(
    submitForReview.bind(null, businessId),
    initialFormState,
  );

  if (state.status === "success") return <FormMessage state={state} />;

  return (
    <form action={action} className="grid gap-3">
      <FormMessage state={state} />
      {ready ? (
        <SubmitButton
          pendingLabel="Изпращане…"
          className="sm:w-auto sm:justify-self-start"
        >
          Изпрати за преглед
        </SubmitButton>
      ) : (
        <p className="text-sm text-muted-foreground">
          Попълни стъпките по-горе, за да изпратиш профила за преглед.
        </p>
      )}
    </form>
  );
}
