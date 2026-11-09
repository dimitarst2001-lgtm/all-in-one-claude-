"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";

export function SubmitButton({
  children,
  pendingLabel,
}: {
  children: React.ReactNode;
  pendingLabel: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      className="w-full"
      disabled={pending}
      aria-disabled={pending}
    >
      {pending && (
        <LoaderCircleIcon className="animate-spin" aria-hidden="true" />
      )}
      {pending ? pendingLabel : children}
    </Button>
  );
}
