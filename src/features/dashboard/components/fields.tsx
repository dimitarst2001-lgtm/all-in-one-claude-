import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Textarea } from "@/components/ui/textarea";

type FieldShellProps = {
  id: string;
  label: string;
  errors?: string[];
  hint?: string;
  children: (aria: {
    id: string;
    "aria-invalid"?: true;
    "aria-describedby"?: string;
  }) => React.ReactNode;
};

/** Label, hint and error wiring shared by non-input controls. */
function FieldShell({ id, label, errors, hint, children }: FieldShellProps) {
  const hasError = Boolean(errors?.length);
  const describedBy =
    [hasError ? `${id}-error` : null, hint && !hasError ? `${id}-hint` : null]
      .filter(Boolean)
      .join(" ") || undefined;
  return (
    <div className="grid gap-2">
      <Label htmlFor={id}>{label}</Label>
      {children({
        id,
        "aria-invalid": hasError || undefined,
        "aria-describedby": describedBy,
      })}
      {hint && !hasError && (
        <p id={`${id}-hint`} className="text-xs text-muted-foreground">
          {hint}
        </p>
      )}
      {hasError && (
        <p id={`${id}-error`} className="text-sm text-destructive">
          {errors![0]}
        </p>
      )}
    </div>
  );
}

export function TextareaField({
  name,
  label,
  errors,
  hint,
  ...props
}: React.ComponentProps<typeof Textarea> & {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
}) {
  return (
    <FieldShell id={props.id ?? name} label={label} errors={errors} hint={hint}>
      {(aria) => <Textarea name={name} {...props} {...aria} />}
    </FieldShell>
  );
}

export function SelectField({
  name,
  label,
  errors,
  hint,
  children,
  ...props
}: React.ComponentProps<typeof NativeSelect> & {
  name: string;
  label: string;
  errors?: string[];
  hint?: string;
}) {
  return (
    <FieldShell id={props.id ?? name} label={label} errors={errors} hint={hint}>
      {(aria) => (
        <NativeSelect name={name} {...props} {...aria}>
          {children}
        </NativeSelect>
      )}
    </FieldShell>
  );
}
