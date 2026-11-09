import Image from "next/image";

import { cn } from "@/lib/utils";

import { publicMediaUrl } from "../format";

/** Logo image, or a monogram tile when the business has not uploaded one. */
export function BusinessLogo({
  name,
  path,
  size = 56,
  className,
}: {
  name: string;
  path: string | null;
  size?: number;
  className?: string;
}) {
  const url = path ? publicMediaUrl(path) : null;
  const initials = name
    .replace(/^Демо\s+/u, "")
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();

  if (url) {
    return (
      <Image
        src={url}
        alt={`Лого на ${name}`}
        width={size}
        height={size}
        className={cn(
          "shrink-0 rounded-md border bg-card object-contain",
          className,
        )}
        style={{ width: size, height: size }}
      />
    );
  }

  return (
    <span
      aria-hidden="true"
      className={cn(
        "flex shrink-0 items-center justify-center rounded-md bg-navy font-semibold tracking-wide text-white",
        className,
      )}
      style={{ width: size, height: size, fontSize: size * 0.32 }}
    >
      {initials}
    </span>
  );
}
