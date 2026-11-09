import Link from "next/link";
import { MailIcon, PhoneIcon } from "lucide-react";

import { Logo } from "@/components/brand/logo";
import { categoryPreviews } from "@/config/categories";
import { legalNav, mainNav } from "@/config/navigation";
import { siteConfig } from "@/config/site";

import { CurrentYear } from "./current-year";

export function SiteFooter() {
  const { email, phone } = siteConfig.contact;

  return (
    <footer className="mt-auto surface-dark">
      <div className="container-page grid gap-10 py-12 md:grid-cols-[1.4fr_1fr_1fr_1fr]">
        <div className="space-y-4">
          <Logo tone="light" />
          <p className="max-w-xs text-sm text-navy-muted">
            {siteConfig.slogan}
          </p>
          {(email || phone) && (
            <ul className="space-y-2 text-sm">
              {email && (
                <li>
                  <a
                    href={`mailto:${email}`}
                    className="inline-flex items-center gap-2 text-navy-foreground hover:text-white"
                  >
                    <MailIcon
                      className="size-4 text-brand"
                      aria-hidden="true"
                    />
                    {email}
                  </a>
                </li>
              )}
              {phone && (
                <li>
                  <a
                    href={`tel:${phone.replace(/\s+/g, "")}`}
                    className="inline-flex items-center gap-2 text-navy-foreground hover:text-white"
                  >
                    <PhoneIcon
                      className="size-4 text-brand"
                      aria-hidden="true"
                    />
                    {phone}
                  </a>
                </li>
              )}
            </ul>
          )}
        </div>

        <FooterColumn title="Услуги">
          {categoryPreviews.map((category) => (
            <li key={category.slug} className="text-navy-muted">
              {category.name}
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Платформа">
          {mainNav.map((item) => (
            <li key={item.href}>
              <FooterLink href={item.href}>{item.title}</FooterLink>
            </li>
          ))}
        </FooterColumn>

        <FooterColumn title="Правна информация">
          {legalNav.map((item) => (
            <li key={item.href}>
              <FooterLink href={item.href}>{item.title}</FooterLink>
            </li>
          ))}
        </FooterColumn>
      </div>

      <div className="border-t border-navy-border">
        <div className="container-page flex flex-col gap-2 py-5 text-xs text-navy-muted sm:flex-row sm:items-center sm:justify-between">
          <p>
            © <CurrentYear /> {siteConfig.name}. Всички права запазени.
          </p>
          <p>Стартираме във {siteConfig.launchCity}. Скоро в цяла България.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h2 className="mb-4 text-sm font-semibold text-white">{title}</h2>
      <ul className="space-y-2.5 text-sm">{children}</ul>
    </div>
  );
}

function FooterLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="text-navy-muted transition-colors hover:text-white"
    >
      {children}
    </Link>
  );
}
