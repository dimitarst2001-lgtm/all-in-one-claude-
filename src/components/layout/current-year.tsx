/**
 * Renders the current year from a cached scope so the footer can stay in the
 * static shell under Cache Components (a bare `new Date()` would make the
 * whole layout request-time).
 */
export async function CurrentYear() {
  "use cache";
  return <>{new Date().getFullYear()}</>;
}
