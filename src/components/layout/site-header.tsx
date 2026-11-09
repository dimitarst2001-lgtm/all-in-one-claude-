import Link from "next/link";
import { Suspense } from "react";

import { Logo } from "@/components/brand/logo";
import { HeaderAccount } from "@/components/layout/header-account";
import { MobileNav } from "@/components/layout/mobile-nav";
import { Button } from "@/components/ui/button";
import { mainNav } from "@/config/navigation";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-navy-border bg-navy/95 text-navy-foreground backdrop-blur supports-[backdrop-filter]:bg-navy/85">
      <div className="container-page flex h-16 items-center gap-6">
        <Logo tone="light" />

        <nav aria-label="Основна навигация" className="hidden flex-1 md:block">
          <ul className="flex items-center gap-1">
            {mainNav.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className="rounded-md px-3 py-2 text-sm font-medium text-navy-muted transition-colors hover:bg-white/5 hover:text-white focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <Suspense fallback={null}>
            <HeaderAccount />
          </Suspense>
          <Button
            asChild
            variant="brand"
            size="sm"
            className="hidden sm:inline-flex"
          >
            <Link href="/for-businesses">Добави бизнес</Link>
          </Button>
          <MobileNav items={mainNav} />
        </div>
      </div>
    </header>
  );
}
