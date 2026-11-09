"use client";

import Link from "next/link";
import { MenuIcon } from "lucide-react";
import { useState } from "react";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NavItem } from "@/config/navigation";

type MobileNavProps = { items: readonly NavItem[] };

export function MobileNav({ items }: MobileNavProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost-dark"
          size="icon"
          className="md:hidden"
          aria-label="Отвори менюто"
        >
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="border-navy-border surface-dark">
        <SheetHeader className="border-b border-navy-border">
          <SheetTitle className="sr-only">Меню</SheetTitle>
          <SheetDescription className="sr-only">
            Основна навигация на сайта
          </SheetDescription>
          <Logo tone="light" />
        </SheetHeader>
        <nav aria-label="Мобилна навигация" className="px-2">
          <ul className="flex flex-col">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-3 text-base font-medium text-navy-foreground hover:bg-white/5"
                >
                  {item.title}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
        <div className="mt-auto border-t border-navy-border p-4">
          <Button asChild variant="brand" className="w-full">
            <Link href="/for-businesses" onClick={() => setOpen(false)}>
              Добави бизнес
            </Link>
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
