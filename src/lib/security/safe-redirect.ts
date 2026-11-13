/**
 * Returns a same-origin relative path, or the fallback. Prevents open
 * redirects via `?next=` parameters (e.g. `//evil.com`, `https://…`, `/\evil`).
 */
export function safeRedirectPath(
  value: unknown,
  fallback = "/account",
): string {
  if (typeof value !== "string") return fallback;
  const path = value.trim();
  if (!path.startsWith("/") || path.startsWith("//") || path.startsWith("/\\"))
    return fallback;
  if (/[\u0000-\u001f]/.test(path)) return fallback;
  return path;
}
