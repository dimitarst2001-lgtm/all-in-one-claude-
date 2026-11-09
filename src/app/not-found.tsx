import Link from "next/link";

import { Logo } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** 404 content; `as` lets segment-level boundaries avoid a nested <main>. */
export function NotFoundContent({ as: Tag = "main" }: { as?: "main" | "div" }) {
  return (
    <Tag className="flex flex-1 flex-col items-center justify-center gap-6 surface-dark px-4 py-24 text-center">
      <Logo tone="light" />
      <div>
        <p className="text-sm font-semibold text-brand">404</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">
          Страницата не е намерена
        </h1>
        <p className="mt-3 text-navy-muted">
          Възможно е адресът да е грешен или страницата да е преместена.
        </p>
      </div>
      <Button asChild variant="brand">
        <Link href="/">Към началото</Link>
      </Button>
    </Tag>
  );
}

export default function NotFound() {
  return <NotFoundContent />;
}
