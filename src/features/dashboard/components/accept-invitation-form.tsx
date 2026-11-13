"use client";

import { useActionState } from "react";

import { FormMessage } from "@/features/auth/components/form-message";
import { SubmitButton } from "@/features/auth/components/submit-button";
import { initialFormState } from "@/features/auth/form-state";

import { acceptInvitation } from "../team-actions";

export function AcceptInvitationForm({ token }: { token: string }) {
  const [state, action] = useActionState(
    acceptInvitation.bind(null, token),
    initialFormState,
  );
  return (
    <form action={action} className="mt-6 grid gap-4">
      <FormMessage state={state} />
      <SubmitButton pendingLabel="Приемане…" className="w-fit">
        Приеми поканата
      </SubmitButton>
    </form>
  );
}
