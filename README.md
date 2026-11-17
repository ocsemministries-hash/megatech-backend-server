# Megatech Backend Server

A modular Express + TypeScript backend for Megatech, pre-wired with
PostgreSQL/Prisma persistence, JWT + OTP authentication for admins and end users,
role-based access control (RBAC), Paystack payments, a newsletter/subscriber
system, Swagger/OpenAPI documentation, structured logging, a mailer with REST +
SMTP fallback, and a full Vitest setup.

## Tech Stack

- **Runtime**: Node.js (>= 22)
- **Framework**: Express 5
- **Language**: TypeScript (strict, NodeNext ESM)
- **Database**: PostgreSQL via Prisma 6 (`prisma-client-js`)
- **Auth**: JWT (access + refresh), bcryptjs, email OTP, signed invite tokens
- **Validation**: Zod 4
- **Logging**: Winston
- **Security**: Helmet, CORS, HPP, express-rate-limit
- **Email**: Mailtrap REST transport with Nodemailer SMTP fallback (dry-run when unconfigured)
- **Payments**: Paystack (server-side initialise + signed webhook)
- **Scheduling**: node-cron (hourly token purge)
- **Documentation**: swagger-ui-express + OpenAPI 3.0
- **Testing**: Vitest, Supertest, @vitest/coverage-v8

## Project Structure

```
├── prisma/
│   ├── schema.prisma           # Datasource + generator (models/enums are merged)
│   ├── enums/status.prisma     # RoleName, PermissionAction, AdminStatus, token enums
│   ├── models/                 # admin, audit, payments, subscriber, user models
│   ├── migrations/             # Single init migration
│   └── seed.ts                 # Seeds the RBAC permission matrix + system roles
├── src/
│   ├── app.ts                  # Express app (middlewares, routes wiring, error handler)
│   ├── server.ts               # Entry point — starts HTTP server + cron (not unit-tested)
│   ├── config/
│   │   └── env.ts              # Centralized environment configuration
│   ├── doc/
│   │   └── swagger.ts          # OpenAPI spec consumed by the /docs UI
│   ├── lib/
│   │   ├── audit/              # Request audit context helpers
│   │   ├── cron/               # node-cron scheduler + purge-expired-tokens job
│   │   ├── dal/                # Data access layer (base repository + per-entity repositories)
│   │   ├── errors/             # HttpError
│   │   ├── events/             # In-process event bus for non-blocking side effects (mail, audit)
│   │   ├── mailer/             # Mailtrap REST + SMTP transports, templates, fallback logic
│   │   ├── security/           # RBAC constants, permission + role sync, request principal
│   │   └── storage/            # Cloudinary signed-upload utility
│   ├── middlewares/
│   │   ├── auth/               # authenticateAdmin, authenticateUser, optionalUser, authorizeRbac
│   │   ├── errorHandler.ts     # Global error handler
│   │   ├── security.ts         # Helmet, CORS, rate-limit, HPP setup
│   │   ├── validate.ts         # Zod body/params validation
│   │   └── validateQuery.ts    # Zod query validation
│   ├── modules/                # Feature modules (route → controller → usecases)
│   │   ├── admin/              # admin CRUD, invite/accept, subscribers, newsletter campaigns, dashboard
│   │   ├── audit/              # audit trail listeners
│   │   ├── auth/               # admin auth: register, verify, login, OTP, refresh, logout, password reset
│   │   ├── payments/           # Paystack payment initialisation + signed webhook
│   │   ├── newsletter/         # public subscribe / unsubscribe
│   │   ├── rbac/               # roles, permissions, role-permission assignment
│   │   └── userAuth/           # end-user auth: register, verify, login, Google, OTP, refresh, logout
│   ├── types/
│   └── utils/                  # cookies, jwt, otp, password, tokens, escapeHtml, logger
├── tests/
│   ├── setup.ts                # Vitest setup (forces NODE_ENV=test)
│   ├── fixtures/               # Reusable test data
│   ├── helpers/                # Env manipulation, supertest request builder
│   ├── mocks/                  # Express mock factories
│   ├── unit/                   # Unit tests (config, lib, middlewares, modules, utils)
│   └── integration/            # End-to-end app tests (app, auth flow)
├── vitest.config.mts           # Vitest config (aliases, coverage, include paths)
├── package.json
└── tsconfig.json
```

Each `src/modules/<name>/` follows the same layering: `*.route.ts` wires the
router and middleware, `*.controller.ts` adapts HTTP ↔ use cases,
`*.usecases.ts` holds the business logic, `validation.schema.ts` holds Zod
schemas, and `doc/*.docs.ts` describes the OpenAPI paths.

## Getting Started

### Prerequisites

- Node.js 22+ (npm 10+)
- A PostgreSQL database

### Installation

```bash
npm install
```

### Environment Variables

Copy the `.env.example` values into a `.env` file at the project root:

| Variable                | Required | Default                 | Description                                                        |
| ----------------------- | -------- | ----------------------- | ------------------------------------------------------------------ |
| `PORT`                  | No       | `5000`                  | Port the server listens on                                         |
| `NODE_ENV`              | No       | `development`           | `development`, `test`, or `production`                             |
| `CORS_ORIGIN`           | No       | `http://localhost:3000,http://localhost:5173` | Comma-separated list of allowed CORS origins                       |
| `DATABASE_URL`          | Yes      | —                       | PostgreSQL connection string used by Prisma                        |
| `DIRECT_URL`            | Yes      | —                       | Direct (non-pooled) PostgreSQL URL                                 |
| `ADMIN_MAILS`           | Yes      | —                       | Comma-separated admin emails: bootstrap gate **and** notification recipients |
| `JWT_ACCESS_SECRET`     | Yes      | `dev-access-secret`     | Signs access tokens                                                |
| `JWT_REFRESH_SECRET`    | Yes      | `dev-refresh-secret`    | Signs refresh tokens                                               |
| `ACCESS_TOKEN_TTL`      | No       | `15m`                   | Access token lifetime                                              |
| `REFRESH_TOKEN_TTL_DAYS`| No       | `7`                     | Refresh token lifetime in days                                     |
| `OTP_TTL_MINUTES`       | No       | `10`                    | OTP validity window                                                |
| `OTP_MAX_ATTEMPTS`      | No       | `5`                     | Failed OTP attempts before invalidation                            |
| `INVITE_TTL_HOURS`      | No       | `72`                    | Admin invite link validity                                         |
| `COOKIE_SECURE`         | No       | prod: `true`            | Force the `Secure` cookie flag                                     |
| `COOKIE_DOMAIN`         | No       | —                       | Cookie domain                                                      |
| `ADMIN_WEB_URL`         | No       | `http://localhost:5173` | Admin app origin, used in invite/verify links                      |
| `FRONTEND_WEB_URL`      | No       | `http://localhost:3000` | Web app origin, used in welcome and payment-return links           |
| `GOOGLE_CLIENT_ID`      | No       | —                       | Google client id used to verify GIS ID tokens                      |
| `EMAIL_DELIVERY_MODE`   | No       | `HYBRID_FALLBACK`       | `REST`, `SMTP` or `HYBRID_FALLBACK` (REST first, SMTP fallback)    |
| `MAILTRAP_API_TOKEN`    | No       | —                       | Mailtrap Email Sending API token                                   |
| `MAILTRAP_API_URL`      | No       | Mailtrap send endpoint  | REST transport endpoint                                            |
| `SMTP_HOST`             | No       | —                       | Blank → emails are logged only (`[mailer:dry-run]`)               |
| `SMTP_PORT`             | No       | `587`                   | SMTP port                                                          |
| `SMTP_USER` / `SMTP_PASS` | No     | —                       | SMTP credentials                                                   |
| `MAIL_FROM`             | No       | `Megatech <no-reply@megatech.org>` | From header for outbound mail       |
| `PAYSTACK_SECRET_KEY`   | No       | —                       | Paystack secret key — payment endpoints return 503 when unset      |
| `CLOUDINARY_*`          | No       | —                       | Cloudinary cloud name/key/secret + upload folder for signed uploads |

> **`SMTP_HOST` blank means no email is delivered.** `sendMail()` resolves with
> `delivered: false` and logs a `[mailer:dry-run]` line instead of throwing, so
> local development and the test suite work without an SMTP server.

### Database Setup

```bash
npm run prisma:generate      # generate the Prisma client
npm run prisma:migrate       # apply migrations in development
npm run prisma:seed          # seed permissions + system roles (SUPER_ADMIN, ADMIN, EDITOR, VIEWER)

# Production
npm run prisma:deploy        # apply migrations without prompts
npm run db:deploy            # migrate deploy + idempotent seed, then exit (CI/release step)
```

### Running the Server

```bash
# Development (auto-reload via tsx watch)
npm run dev

# Production build
npm run build
npm start
```

### Deploy-time Database Bootstrap

`npm start` runs a database bootstrap **before** the server listens, so a fresh
environment (or a new `DATABASE_URL`) self-provisions on deploy:

1. `prisma migrate deploy` — applies every pending migration (non-interactive;
   a fast no-op when already up to date).
2. The permission sync — every `resource:action` key in `rbac.constants.ts`
   that is missing from the DB gets inserted. Existing rows and role
   assignments are never touched, so adding a resource to `RBAC_RESOURCES`
   lands in the DB on the next boot.

Each step can be disabled independently when migrations are managed elsewhere
(e.g. a CI release job): set `DEPLOY_MIGRATE=false` and/or `DEPLOY_SYNC=false`.
The same steps can be run standalone via `npm run db:deploy` (source, via tsx)
or `node dist/deploy.js` (compiled), which exits non-zero on failure for
pipeline use.

The server logs its startup line on the configured port. Interactive API docs are
served at `http://localhost:<PORT>/docs`, the raw spec at `/docs-json`, and a
health check at `GET /health`.

## API Overview

All application routes are mounted under `/api/v1`:

| Mount                       | Auth                 | Purpose                                        |
| --------------------------- | -------------------- | ---------------------------------------------- |
| `/api/v1/admin/auth`        | Mixed                | Admin register, verify email/OTP, login (MFA), refresh, logout, me, change password, forgot/reset password |
| `/api/v1/admin`             | Bearer + RBAC        | Admin CRUD, invite acceptance, subscribers, newsletter campaigns, dashboard summary |
| `/api/v1/admin` (rbac)      | Bearer + RBAC        | Roles and permission matrix management         |
| `/api/v1/auth`              | Mixed                | End-user register, verify email, login (MFA + Google), refresh, logout, me |
| `/api/v1/newsletter`        | Public               | Mailing-list subscribe / unsubscribe          |
| `/api/v1/payments`          | Public / signature   | Paystack transaction initialise + webhook     |

`GET /`, `GET /docs`, `GET /docs-json` and `GET /health` are mounted outside the
`/api/v1` prefix.

Passwords are hashed with bcryptjs; access/refresh tokens are JWTs delivered via
HTTP-only cookies. `authenticateAdmin` verifies the access token, and
`authorizeRbac(resource, action)` enforces a `resource:action` permission key
(see `src/lib/security/rbac.constants.ts`) — a `SUPER_ADMIN` bypasses RBAC checks.

### Background side effects

Mail, audit rows and newsletter sends never run inline in the request. Modules
emit onto the shared in-process bus (`src/lib/events`) and listeners registered
at boot (`initializeEventListeners()`) perform the work, logging failures
instead of throwing, so a mail outage cannot fail a signup or invite.

### Password recovery

Two public endpoints back the admin panel's "forgot password" screen:

| Method | Path                            | Notes |
| ------ | ------------------------------- | ----- |
| POST   | `/api/v1/admin/auth/forgot-password` | Emails a `RESET_PASSWORD` OTP. Always returns the same generic acknowledgement, so it cannot be used to enumerate admin emails. |
| POST   | `/api/v1/admin/auth/reset-password`  | Verifies the OTP, stores the new password hash, and consumes every outstanding `REFRESH` token so sessions minted with the old password can no longer be renewed. |

The emailed code follows the same single-active/expiry/attempt-limit rules as
login OTPs (`OTP_TTL_MINUTES`, `OTP_MAX_ATTEMPTS`).

### RBAC model

- **Resources**: `admins, roles, accounts, profile, audit, dashboard, subscribers` (extend `RBAC_RESOURCES` as new modules ship — the startup sync inserts the missing keys)
- **Actions**: `view, create, export, update, delete`
- **Permission key**: `` `${resource}:${action}` `` (e.g. `accounts:update`)

### Mailer (core mailing system)

Outbound email lives in `src/lib/mailer` — templates (`otp`, `reset-password`,
`admin-invite`, `welcome`, `newsletter`), channel selection (REST / SMTP /
hybrid fallback), and the `sendMail` entry point. It backs the auth flows (OTP,
invites, password reset) and newsletter broadcasts. Sends are dispatched from
event listeners, not from request handlers.

## Testing

```bash
# Run the full suite once
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with a coverage report (text + HTML in ./coverage)
npm run test:coverage
```

Tests use Vitest with Supertest against the exported Express `app` (no real port
binding required). New API endpoints should ship with matching integration tests
under `tests/integration/`, and new pure logic with unit tests under `tests/unit/`.

## Adding a New Module

Create `src/modules/<module>/` with the standard files (`route`, `controller`,
`usecases`, `validation.schema`, `doc`), then wire the router in `src/app.ts`:

```ts
// src/app.ts
app.use('/api/v1/<module>', myRouter());
```

Register new OpenAPI paths/schemas in the module's `doc/*.docs.ts` (aggregated by
`src/doc/swagger.ts`) so they appear in the `/docs` UI. Add the resource to
`RBAC_RESOURCES` if it needs permission-gated access, then re-run `npm run prisma:seed`.

## Security Notes

- JSON body payloads are limited to `10kb`.
- Requests to `/api` are rate-limited (100 requests / 15 minutes).
- Security headers are applied via Helmet; CORS is restricted to `CORS_ORIGIN`.
- In `production`, internal error messages for 5xx responses are masked to `Internal Server Error`.
- A scheduled cron job (`17 * * * *`) purges expired/consumed verification tokens.

## License

ISC
