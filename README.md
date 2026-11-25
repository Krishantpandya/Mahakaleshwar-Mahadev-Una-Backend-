# Mankaleshwar Mahadev Backend

TypeScript API service for the Mankaleshwar Mahadev Temple website.

## Current foundation

- Fastify 5 HTTP server
- Strict TypeScript configuration
- Environment validation with Zod
- Security headers with Helmet
- Explicit CORS allowlist
- Global rate limiting
- Structured logging with sensitive header redaction
- Versioned health endpoint: `GET /api/v1/health`
- Graceful shutdown on SIGINT and SIGTERM

## Requirements

- Node.js 22 or newer
- npm

## Run locally

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start development mode with `npm run dev`.

## Available commands

- `npm run dev` — development server with reload
- `npm run typecheck` — TypeScript type checking
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server

The API listens on port 4000 by default.

## Scope decisions intentionally deferred

The repository requirements leave several product and provider decisions open. This foundation does not invent those decisions. Database selection and schema, admin authentication and permissions, comment moderation and abuse controls, notification delivery, and media storage integration must be designed before their corresponding features are implemented.

## API

### Health

`GET /api/v1/health`

Returns the service status and timestamp. This is a process-level health check; it does not yet verify database, storage, or notification-provider connectivity.

## Database

The initial PostgreSQL schema is in `database/migrations/001_initial_schema.sql`.
It defines admins, photos, guest photo likes/comments, announcements, browser push
subscriptions, and the independent `photos` / `announcements` subscription channels.

### Apply the initial migration

Create an empty PostgreSQL 15+ database, then apply the migration using your
PostgreSQL SQL client or deployment workflow. The migration is intended to be
applied once to an empty database. Future schema changes must be added as new,
ordered SQL migration files; do not modify a migration after it has been applied.

No database credentials or connection strings are committed to this repository.

### Schema boundaries

- Media records store generic storage keys and media URLs. No storage vendor is selected.
- Guest likes and comments use opaque client-generated visitor UUIDs; no visitor account is created.
- Comment moderation/display rules remain undecided and must be settled before public comment publishing is enabled.
- Admin roles, login/session strategy, and password reset policy remain to be designed.
- Push subscription data follows the browser Push API shape; delivery provider and retry/expiry policies remain undecided.
- Like removal behavior and subscription lifecycle rules are handled by future API behavior, not assumed by this schema.
