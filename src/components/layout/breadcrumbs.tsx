import Link from "next/link";
import { ChevronRightIcon } from "lucide-react";

import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export type Crumb = { name: string; href: string };

/** Visible breadcrumbs plus matching BreadcrumbList structured data. */
export function Breadcrumbs({
  items,
  tone = "light",
  className,
}: {
  items: Crumb[];
  tone?: "light" | "dark";
  className?: string;
}) {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: new URL(item.href, siteConfig.url).toString(),
    })),
  };

  return (
    <nav aria-label="Навигационна пътека" className={className}>
      <ol
        className={cn(
          "flex flex-wrap items-center gap-1 text-sm",
          tone === "dark" ? "text-navy-muted" : "text-muted-foreground",
        )}
      >
        {items.map((item, index) => {
          const isLast = index === items.length - 1;
          return (
            <li key={item.href} className="flex items-center gap-1">
              {isLast ? (
                <span
                  aria-current="page"
                  className={
                    tone === "dark" ? "text-navy-foreground" : "text-foreground"
                  }
                >
                  {item.name}
                </span>
              ) : (
                <Link href={item.href} className="hover:underline">
                  {item.name}
                </Link>
              )}
              {!isLast && (
                <ChevronRightIcon className="size-3.5" aria-hidden="true" />
              )}
            </li>
          );
        })}
      </ol>
      <JsonLd data={jsonLd} />
    </nav>
  );
}

/** Serialises structured data safely (escapes `<` so it cannot close the script tag). */
export function JsonLd({ data }: { data: unknown }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}
