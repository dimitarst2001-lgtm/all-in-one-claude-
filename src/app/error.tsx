"use client";

import { useEffect } from "react";

import { Button } from "@/components/ui/button";

export default function SegmentError({
  error,
  retry,
}: {
  error: unknown;
  retry: () => void;
}) {
  useEffect(() => {
    // Reported to Sentry once monitoring is wired up (Phase 8).
    console.error(error);
  }, [error]);

  const digest =
    error instanceof Error &&
    "digest" in error &&
    typeof error.digest === "string"
      ? error.digest
      : undefined;

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold">Нещо се обърка</h1>
      <p className="max-w-md text-muted-foreground">
        Не успяхме да заредим страницата. Опитай отново след малко.
      </p>
      {digest && <p className="text-xs text-muted-foreground">Код: {digest}</p>}
      <Button onClick={() => retry()}>Опитай отново</Button>
    </main>
  );
}
