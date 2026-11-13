import { cn } from "@/lib/utils";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description?: string;
  className?: string;
  children?: React.ReactNode;
};

/** Standard dark intro band used at the top of content pages. */
export function PageHeader({
  eyebrow,
  title,
  description,
  className,
  children,
}: PageHeaderProps) {
  return (
    <section className={cn("surface-dark", className)}>
      <div className="container-page py-12 md:py-16">
        {eyebrow && (
          <p className="mb-3 text-sm font-semibold tracking-wide text-brand uppercase">
            {eyebrow}
          </p>
        )}
        <h1 className="max-w-3xl text-3xl font-semibold text-white md:text-4xl">
          {title}
        </h1>
        {description && (
          <p className="mt-4 max-w-2xl text-base text-navy-muted md:text-lg">
            {description}
          </p>
        )}
        {children}
      </div>
    </section>
  );
}
