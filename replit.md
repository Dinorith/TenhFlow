# TenhFlow

A social-commerce order workspace for Cambodian sellers. TenhFlow turns English, Khmer, and mixed customer messages into reviewable order suggestions, then lets the seller confirm and manage the order.

## Run & Operate

- `pnpm --filter @workspace/api-server run dev` — run the API server (port 5000)
- `pnpm --filter @workspace/tenhflow run dev` — run the TenhFlow web app
- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from the OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- Required environment: PostgreSQL `DATABASE_URL` and Replit-managed Clerk authentication

## Stack

- pnpm workspaces, Node.js 24, TypeScript 5.9
- Web: React, Vite, Wouter, TanStack Query, Clerk
- API: Express 5, Clerk middleware and same-origin Frontend API proxy
- DB: PostgreSQL + Drizzle ORM
- Validation: Zod (`zod/v4`), `drizzle-zod`
- API codegen: Orval (from OpenAPI spec)
- Build: esbuild (CJS bundle)

## Where things live

- `artifacts/tenhflow/` — seller web app, routes, styles, and logo
- `artifacts/api-server/src/routes/tenhflow.ts` — authenticated TenhFlow API
- `artifacts/api-server/src/lib/tenhflowData.ts` — owner-scoped records and demo data
- `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` — production Clerk proxy
- `lib/api-spec/openapi.yaml` — API contract source of truth
- `lib/db/src/schema/tenhflow.ts` — PostgreSQL record table schema
- Generated clients and validators live in `lib/api-client-react/` and `lib/api-zod/`

## Architecture decisions

- API contracts are edited in OpenAPI and regenerated with `pnpm --filter @workspace/api-spec run codegen`.
- Tenant identity comes only from the verified Clerk session. Every stored record is queried with that authenticated owner ID; clients must never provide an owner ID.
- Demo shop data is seeded independently for each new account, so the signed-in experience works without connecting social channels.
- Product/channel states are honest: the app does not send messages or claim Facebook, Messenger, Telegram, or TikTok is connected.
- Captures are suggestions. A separate seller confirmation is required before an order is created.

## Product

- Public landing and Clerk sign-in/sign-up, followed by first-shop onboarding
- Dashboard, customer capture and inbox, orders, customer profiles, product stock, delivery, payments, and shop settings
- Khmer/English message capture with editable product, variant, quantity, contact, and address fields
- Demo channel states only; real social-channel connections are outside the current implementation

## User preferences

- Keep the product specific to Cambodian social-commerce sellers and fast message-to-order work.
- Default to a light, clean and professional interface, with dark mode and responsive layouts.
- Do not finalize orders or send customer messages without a clear seller action.

## Gotchas

- Push database schema changes with `pnpm --filter @workspace/db run push` in development.
- Regenerate both typed clients after changing the OpenAPI contract.
- Keep Clerk auth routes and its `/api/__clerk` proxy path working through the Replit preview base path.

## Pointers

- See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details
