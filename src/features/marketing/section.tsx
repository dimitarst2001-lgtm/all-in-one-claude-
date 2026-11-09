import { cn } from "@/lib/utils";

type SectionProps = {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  children: React.ReactNode;
};

export function Section({
  id,
  eyebrow,
  title,
  description,
  className,
  children,
}: SectionProps) {
  const headingId = id ? `${id}-heading` : undefined;

  return (
    <section
      id={id}
      aria-labelledby={headingId}
      className={cn("scroll-mt-20 py-16 md:py-20", className)}
    >
      <div className="container-page">
        <div className="mb-10 max-w-2xl">
          {eyebrow && (
            <p className="mb-2 text-sm font-semibold tracking-wide text-primary uppercase">
              {eyebrow}
            </p>
          )}
          <h2 id={headingId} className="text-2xl font-semibold md:text-3xl">
            {title}
          </h2>
          {description && (
            <p className="mt-3 text-muted-foreground md:text-lg">
              {description}
            </p>
          )}
        </div>
        {children}
      </div>
    </section>
  );
}
