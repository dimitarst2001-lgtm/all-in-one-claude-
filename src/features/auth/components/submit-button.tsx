"use client";

import { LoaderCircleIcon } from "lucide-react";
import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function SubmitButton({
  children,
  pendingLabel,
  className,
  variant,
}: {
  children: React.ReactNode;
  pendingLabel: string;
  className?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      className={cn("w-full", className)}
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
