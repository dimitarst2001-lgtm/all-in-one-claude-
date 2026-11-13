"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ClockIcon,
  LayoutDashboardIcon,
  ListChecksIcon,
  MapPinIcon,
  StoreIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

const items = [
  { segment: "", label: "Преглед", icon: LayoutDashboardIcon },
  { segment: "/profile", label: "Профил", icon: StoreIcon },
  { segment: "/location", label: "Адрес", icon: MapPinIcon },
  { segment: "/hours", label: "Работно време", icon: ClockIcon },
  { segment: "/services", label: "Услуги", icon: ListChecksIcon },
] as const;

export function DashboardNav({ businessId }: { businessId: string }) {
  const pathname = usePathname();
  const base = `/dashboard/${businessId}`;

  return (
    <nav aria-label="Табло на бизнеса" className="-mx-4 overflow-x-auto px-4">
      <ul className="flex min-w-max gap-1 border-b">
        {items.map(({ segment, label, icon: Icon }) => {
          const href = `${base}${segment}`;
          const active = pathname === href;
          return (
            <li key={segment}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px flex items-center gap-2 border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "border-primary text-primary"
                    : "border-transparent text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-4" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
