import Link from "next/link";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

import { Button } from "@/components/ui/button";

type PaginationProps = {
  page: number;
  totalPages: number;
  hrefForPage: (page: number) => string;
};

export function Pagination({ page, totalPages, hrefForPage }: PaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <nav
      aria-label="Страници с резултати"
      className="flex items-center justify-between gap-3"
    >
      {page > 1 ? (
        <Button asChild variant="outline">
          <Link href={hrefForPage(page - 1)} rel="prev">
            <ChevronLeftIcon aria-hidden="true" />
            Предишна
          </Link>
        </Button>
      ) : (
        <span />
      )}
      <p className="text-sm text-muted-foreground">
        Страница {page} от {totalPages}
      </p>
      {page < totalPages ? (
        <Button asChild variant="outline">
          <Link href={hrefForPage(page + 1)} rel="next">
            Следваща
            <ChevronRightIcon aria-hidden="true" />
          </Link>
        </Button>
      ) : (
        <span />
      )}
    </nav>
  );
}
