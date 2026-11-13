import { TriangleAlertIcon } from "lucide-react";

import { PageHeader } from "@/components/layout/page-header";

type LegalPageProps = {
  title: string;
  description: string;
  children: React.ReactNode;
};

/**
 * Shared shell for legal documents. Every legal text is a draft until it has
 * been reviewed by a lawyer (see SECURITY.md); the banner says so publicly.
 */
export function LegalPage({ title, description, children }: LegalPageProps) {
  return (
    <>
      <PageHeader
        eyebrow="Правна информация"
        title={title}
        description={description}
      />
      <div className="container-page py-12 md:py-16">
        <div
          role="note"
          className="mb-10 flex max-w-3xl gap-3 rounded-lg border border-warning/40 bg-warning/10 p-4 text-sm"
        >
          <TriangleAlertIcon
            className="mt-0.5 size-4 shrink-0 text-[#8a5300]"
            aria-hidden="true"
          />
          <p>
            Това е работна версия на документа. Окончателният текст ще бъде
            публикуван след правен преглед и преди търговския старт на
            платформата.
          </p>
        </div>
        <article className="max-w-3xl space-y-8 text-[0.95rem] leading-relaxed [&_h2]:text-xl [&_h2]:font-semibold [&_li]:ml-5 [&_li]:list-disc [&_p]:text-muted-foreground [&_section]:space-y-3 [&_ul]:space-y-1.5 [&_ul]:text-muted-foreground">
          {children}
        </article>
      </div>
    </>
  );
}
