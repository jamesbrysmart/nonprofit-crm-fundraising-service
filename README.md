## Fundraising Service

Fundraising service is the managed-extension API that brokers donation intake into Twenty. It validates inbound gifts, stages them when manual review is required, forwards clean payloads to Twenty’s REST API, and surfaces tooling for intake connectors (Stripe), gift staging, and lightweight admin UI flows.

### Highlights
- NestJS service with React/Vite client bundled into the same container (`/fundraising` route served by `main.ts`).
- Gift proxy with validation, contact dedupe against Twenty `/people/duplicates`, and optional staging/processing path.
- Recurring agreement proxy for CRUD access to the `recurringAgreements` metadata we provisioned (Stripe/GoCardless first slice).
- Stripe webhook adapter normalises `checkout.session.completed` events into the gift contract defined in `docs/features/donation-intake.md` and enriches recurring metadata.
- Structured JSON logging plus `x-request-id` propagation for request tracing (see `docs/OPERATIONS_RUNBOOK.md`).
- Smoke scripts and metadata helpers to provision the custom objects described in `docs/data-model/fundraising.md`.

### Architecture Overview
- `AppModule` wires core modules: `GiftModule`, `GiftStagingModule`, `PeopleModule`, `RecurringAgreementModule`, `StripeModule`, `TwentyModule`, and logging.
- `GiftService` prepares payloads, ensures donor contacts exist, and calls Twenty via `TwentyApiService` with retries and error logging.
- `GiftStagingService` and `GiftStagingProcessingService` implement the staging state machine described in `docs/features/donation-staging.md`; they remain behind `FUNDRAISING_ENABLE_GIFT_STAGING`.
- `PeopleService` exposes `/people/duplicates` proxying to Twenty to support manual intake dedupe.
- `StripeWebhookService` verifies signatures, converts checkout sessions into the canonical gift payload, and reuses the gift service for promotion (`docs/DONATION_CONNECTOR_SCAFFOLDING.md`).
- Frontend (`client/`) provides the POC manual gift entry UI, staging queue with recurring filters, and a lightweight recurring agreement list.

### API Surface (default prefix `http://localhost:4500/api/fundraising`)
- `POST /gifts` → validate payload, optionally stage, or forward to Twenty `/gifts`.
- `GET /gifts`, `GET /gifts/:id`, `PATCH /gifts/:id`, `DELETE /gifts/:id` → transparent proxy to Twenty gift endpoints.
- `POST /people/duplicates` → proxy for duplicate detection ahead of contact creation.
- `POST /webhooks/stripe` → Stripe webhook verifier; requires `STRIPE_WEBHOOK_SECRET`.
- Staging (feature flagged):
  - `GET /gift-staging` → list staging records for review (filters via query params).
  - `PATCH /gift-staging/:id/status` → reviewer updates for validation/dedupe state.
  - `POST /gift-staging/:id/process` → manual processing path (`docs/solutions/gift-staging-processing.md`).
  - _Heads-up_: older scripts may still target `/promote`; update them to `/process` as you bump dependencies.
- Recurring agreements:
  - `GET /recurring-agreements` → proxy Twenty recurring agreement records (supports `limit`, `cursor`, and client-side filters).
  - `POST /recurring-agreements` / `PATCH /recurring-agreements/:id` → pass-through for metadata updates (used by connectors).
- GoCardless webhook skeleton (`POST /webhooks/gocardless`) logs incoming events and prepares for Direct Debit ingestion.
- Health: `GET /health` is exposed separately without the `/api/fundraising` prefix.

### Getting Started
- **Docker (recommended for dev stack)**  
  ```
  docker compose up -d --build
  ```
  Refer to `docs/OPERATIONS_RUNBOOK.md` for deeper operations guidance and smoke checks.

- **Local Node workflow**
  ```
  npm install
  npm run start:dev          # Nest API with file watching
  npm run client:dev         # Optional Vite dev server for the admin UI
  ```
  The compiled build (`npm run build`) packages both the Nest API and the client into `dist/`.

- **Metadata provisioning**  
  `npm run setup:schema` boots `scripts/setup-schema.mjs`, seeding the custom objects/fields outlined in `docs/TWENTY_METADATA_API.md` and `docs/data-model/fundraising.md`. Lookup fields still require manual setup in Twenty until metadata API gaps close.

- **Smoke test**  
  `npm run smoke:gifts` exercises staging (auto-promote off), manual processing, and the proxy CRUD flow end-to-end against Twenty; see script comments for behaviour.

### Environment Variables
| Variable | Purpose | Default / Notes |
| --- | --- | --- |
| `TWENTY_API_KEY` | Required bearer token for Twenty REST calls | **Must be supplied** |
| `TWENTY_API_BASE_URL` / `TWENTY_REST_BASE_URL` | Override Twenty REST base URL | Defaults to `http://server:3000/rest` |
| `STRIPE_API_KEY` | API key used by the Stripe SDK | Required for webhook signature verification; can be a restricted key |
| `STRIPE_WEBHOOK_SECRET` | Signing secret for `/webhooks/stripe` | If missing, service returns HTTP 503 |
| `FUNDRAISING_ENABLE_GIFT_STAGING` | Toggle staging flow (`true`/`false`) | Defaults to disabled; align with `docs/features/donation-staging.md` |
| `FUNDRAISING_STAGING_AUTO_PROMOTE_DEFAULT` | Default auto-promote behaviour for staged rows | Defaults to `true`; set to `false` for manual review-first workflows |
| `PORT` | HTTP port for the Nest server | Defaults to `3000` (proxied to `:4500` in docker compose) |
| `TWENTY_METADATA_BASE_URL` | Used by `setup-schema.mjs` when provisioning metadata | Optional |

Environment values can be stored in `.env` (see `.env.example`) or injected via docker compose profiles.

### Development Commands
- `npm run lint` / `npm run format` → ESLint + Prettier.
- `npm run test`, `npm run test:watch`, `npm run test:e2e` → Jest suites (unit + e2e).
- `npm run client:build`, `npm run client:preview` → Build/preview the React client assets.

### Reference Material
- Fundraising data model: `docs/data-model/fundraising.md`
- Intake & staging flows: `docs/features/donation-intake.md`, `docs/features/donation-staging.md`
- Reconciliation alignment: `docs/features/donation-reconciliation.md`
- Connector blueprint & Stripe onboarding: `docs/DONATION_CONNECTOR_SCAFFOLDING.md`
- Gift API proxy behaviour: `docs/TWENTY_GIFTS_API.md`
- Operations checklist: `docs/OPERATIONS_RUNBOOK.md`

Keep this README aligned with the feature docs as the managed fundraising extension evolves.
