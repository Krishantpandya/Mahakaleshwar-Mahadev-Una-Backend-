# Mankaleshwar Mahadev Backend

TypeScript API service for the Mankaleshwar Mahadev Temple website.

## Stack
- Node.js 22+
- Fastify 5 and TypeScript
- PostgreSQL 17 hosted on Neon
- Zod request and environment validation

## Run locally
1. Copy .env.example to .env.
2. Set DATABASE_URL to a PostgreSQL connection string (use a pooled Neon URL for API traffic).
3. Install dependencies with npm install.
4. Run npm run dev.

## Commands
- npm run dev — development server with reload
- npm run typecheck — TypeScript type checking
- npm run build — compile to dist/
- npm start — run compiled server
- npm run admin:create — one-time creation of the single admin account; requires DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD (12+ characters)

## API v1
All endpoints are under /api/v1.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | /health | Process health check |
| GET | /photos | List published photos; supports from, to, limit, offset |
| POST | /photos/:photoId/likes | Add an idempotent guest like using a client-generated visitorId UUID |
| GET | /announcements | List published announcements; supports limit, offset |
| PUT | /push-subscriptions | Register/update a browser push subscription for one or both notification channels |
| POST | /admin/auth/login | Authenticate the single admin and issue an HttpOnly session cookie |
| POST | /admin/auth/logout | Revoke the current admin session |
| GET | /admin/auth/me | Check the current admin session |

## Single-admin security
Apply database migration 002 before enabling admin authentication. It creates server-side sessions and a database constraint that permits only one admin row. Admin passwords are hashed with Node.js scrypt and a random salt; raw passwords are never stored. Session tokens are random, stored only as SHA-256 hashes, and delivered in HttpOnly, SameSite=Strict cookies (Secure in production). Login is rate-limited.

Provision the account once using the deployment environment's secret variables: DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD (minimum 12 characters), then run npm run admin:create. Do not leave ADMIN_PASSWORD configured after provisioning. Do not expose the provisioning command as a public HTTP endpoint.

The content endpoints require DATABASE_URL. If it is not configured, they return HTTP 503 rather than pretending the database is available.

## Browser notification subscriptions
PUT /push-subscriptions stores browser subscriptions and channel choices only. Push delivery, VAPID key management, retries, and automatic publish triggers remain separate implementation work.

## Database
The initial schema is in database/migrations/001_initial_schema.sql. Migration 002 is database/migrations/002_single_admin_sessions.sql. The initial schema has been applied to Neon project mankaleshwar-mahadev (PostgreSQL 17, AWS Singapore). Never commit database credentials or admin secrets.

## Remaining implementation
- Admin photo and announcement management APIs
- Media upload/storage provider integration (provider not selected)
- Guest comments and moderation rules
- Browser push delivery and automatic publish triggers
- Automated API/integration tests
- Production hosting configuration and live deployment
- Pujari/admin contact workflow (not decided)
