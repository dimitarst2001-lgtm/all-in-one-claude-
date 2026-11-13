# Development Log

Newest entries first. Each entry records what changed, how it was verified and
what is still open. Nothing is listed as done without verification evidence.

---

## 2026-11-09 — Phase 0 and Phase 1 (foundation)

### Phase 0 — inspection

| Item | Finding |
| --- | --- |
| Repository | `dimitarst2001-lgtm/all-in-one-claude-`, empty (no commits) |
| Framework / dependencies | none |
| Database | none |
| Deployment config | none |
| Environment variables | none |
| Toolchain in dev container | Node 22.23, pnpm 10.28 |

Decision: initialise a fresh Next.js 16.4.5 project (`create-next-app`) with
TypeScript, Tailwind v4, ESLint, App Router, `src/` and the `@/*` alias.

Research notes:
- **Open Charge Map**: data under CC BY 4.0 for user contributions; imported
  third-party data stays under its provider's licence; apps must display data
  provider attribution; API key is mandatory. Source:
  https://openchargemap.org/site/about/terms
- **Stripe** operates in Bulgaria and supports EUR Billing. The BGN/EUR dual
  price display obligation ran 2025-08-08 → 2026-08-08 and has ended.
  Source: https://support.stripe.com/questions/dual-price-indication-requirements-for-customers-in-bulgaria
- **Sandbox limitation**: `ui.shadcn.com` is blocked by the development
  container's network policy, so shadcn/ui components were added as owned
  source files following the shadcn "new-york"/radix conventions, with a
  `components.json` so the CLI works normally on a developer machine.

### Phase 1 — foundation

Implemented:
- Next.js 16.4.5 App Router, React 19.3, TypeScript strict, Tailwind v4,
  Cache Components enabled (see ADR-001).
- Design tokens in `src/app/globals.css` (brand palette, semantic shadcn
  tokens, `surface-dark` and `container-page` utilities). Contrast decision:
  filled buttons and link text use `#1565C0`; `#2196F3` is reserved for
  accents, icons and focus rings (white on `#2196F3` is only 3.1:1).
- shadcn/ui primitives: button, badge, card, input, label, separator, sheet,
  skeleton.
- Brand logo mark, dark navy sticky header, mobile navigation sheet, footer
  with legal links and env-driven contact details.
- Homepage (static marketing version), `/for-businesses` with plan previews,
  legal drafts (`/privacy`, `/terms`, `/cookies`) with a public "pending legal
  review" notice, 404 and error boundary.
- Supabase clients: browser, server (cookies), service role (`server-only`),
  and `src/proxy.ts` session refresh with CDN cache-header forwarding.
- Zod-validated env split into public and server modules; integrations fail
  with a clear `MissingConfigError` when used unconfigured. `.env.example`.
- Vitest set up with 7 env validation tests.

Deliberately not in Phase 1 (to avoid buttons that lead nowhere): city
selector, search bar, featured businesses, auth links. They arrive with real
data in Phases 2–3.

Verification (2026-11-09):
- `pnpm typecheck` ✅ · `pnpm lint` ✅ (0 problems) · `pnpm test` ✅ 7/7 ·
  `pnpm build` ✅ (all routes prerendered static).
- Playwright smoke run against `next start`: `/`, `/for-businesses`,
  `/privacy` at 1366×900 and iPhone 13; no console errors; no horizontal
  scroll on mobile (scrollWidth 390); mobile menu opens and closes.

Open items: Supabase, OCM and OpenFreeMap hosts are blocked from the
development container, so integrations are verified against real services
from a developer machine or Vercel preview.
