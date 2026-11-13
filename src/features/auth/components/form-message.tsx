import { CircleAlertIcon, CircleCheckIcon } from "lucide-react";

import { cn } from "@/lib/utils";

import type { FormState } from "../form-state";

export function FormMessage({ state }: { state: FormState }) {
  if (!state.message || state.status === "idle") return null;
  const isError = state.status === "error";
  const Icon = isError ? CircleAlertIcon : CircleCheckIcon;

  return (
    <div
      role={isError ? "alert" : "status"}
      className={cn(
        "flex gap-2.5 rounded-md border p-3 text-sm",
        isError
          ? "border-destructive/30 bg-destructive/5 text-destructive"
          : "border-success/30 bg-success/5 text-success",
      )}
    >
      <Icon className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      <p>{state.message}</p>
    </div>
  );
}
