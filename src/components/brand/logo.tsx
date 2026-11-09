import Link from "next/link";

import { cn } from "@/lib/utils";

type LogoMarkProps = { className?: string };

/** Brand mark: a location pin whose centre is a wheel hub. */
export function LogoMark({ className }: LogoMarkProps) {
  return (
    <svg
      viewBox="0 0 32 32"
      aria-hidden="true"
      className={cn("size-8 shrink-0", className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect width="32" height="32" rx="7" fill="#2196F3" />
      <path
        d="M16 5.5c-4.7 0-8.5 3.7-8.5 8.3 0 5.9 7.1 12 7.9 12.6.4.3.9.3 1.2 0 .8-.7 7.9-6.7 7.9-12.6 0-4.6-3.8-8.3-8.5-8.3Z"
        fill="#fff"
      />
      <circle cx="16" cy="13.8" r="4.1" fill="#1565C0" />
      <circle cx="16" cy="13.8" r="1.5" fill="#fff" />
      <path
        d="M16 9.7v2.6M16 15.3v2.6M11.9 13.8h2.6M17.5 13.8h2.6"
        stroke="#fff"
        strokeWidth="1"
        strokeLinecap="round"
      />
    </svg>
  );
}

type LogoProps = {
  className?: string;
  /** Use light text for dark (navy) surfaces. */
  tone?: "light" | "dark";
};

export function Logo({ className, tone = "light" }: LogoProps) {
  return (
    <Link
      href="/"
      className={cn(
        "inline-flex items-center gap-2.5 rounded-md focus-visible:ring-[3px] focus-visible:ring-ring/40 focus-visible:outline-none",
        className,
      )}
      aria-label="All in One Auto — начало"
    >
      <LogoMark />
      <span
        className={cn(
          "text-[1.05rem] leading-none font-semibold tracking-tight",
          tone === "light" ? "text-white" : "text-foreground",
        )}
      >
        All in One <span className="text-brand">Auto</span>
      </span>
    </Link>
  );
}
