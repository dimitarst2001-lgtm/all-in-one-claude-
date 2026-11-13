import Link from "next/link";

import { legalNav } from "@/config/navigation";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <main id="main" className="flex min-h-full flex-1 flex-col bg-background">
      {children}
      <nav aria-label="Правна информация" className="pb-8">
        <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 px-4 text-xs text-muted-foreground">
          {legalNav.map((item) => (
            <li key={item.href}>
              <Link href={item.href} className="hover:text-foreground">
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
