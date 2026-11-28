# Mankaleshwar Mahadev Backend

TypeScript API service for the Mankaleshwar Mahadev Temple website.

## Stack
- Node.js 22+
- Fastify 5 and TypeScript
- PostgreSQL 17 hosted on Neon
- Backblaze B2 private object storage through its S3-compatible API
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
| GET | /photos | List published photos; supports from, to, limit, offset; returns temporary private-media URLs |
| GET | /photos/:photoId/download | Redirect to a temporary download URL for a published photo |
| POST | /photos/:photoId/likes | Add an idempotent guest like using a client-generated visitorId UUID |
| GET | /announcements | List published announcements and sign private poster URLs |
| POST | /admin/photos | Upload and publish one image; requires the admin session cookie and multipart form data |
| POST | /admin/auth/login | Authenticate the single admin and issue an HttpOnly session cookie |
| POST | /admin/auth/logout | Revoke the current admin session |
| GET | /admin/auth/me | Check the current admin session |
| PUT | /push-subscriptions | Register/update a browser push subscription for one or both notification channels |

## Private Backblaze B2 storage
The backend uses the B2 S3-compatible API. Configure all five values together in the backend environment:
- B2_BUCKET_NAME
- B2_REGION
- B2_ENDPOINT (for example, the HTTPS S3 endpoint shown in the B2 bucket details)
- B2_KEY_ID
- B2_APPLICATION_KEY

Use a standard application key restricted to the single media bucket. Grant the file read, write, and delete capabilities needed by the upload, download, and failed-upload cleanup paths. Do not use the account master key. Do not put B2 credentials in frontend code or source control.

The bucket remains private. Public photo and announcement listing endpoints generate short-lived signed GET URLs at request time; those URLs are not stored in Neon. Photo uploads are accepted only by the admin-authenticated API. The upload endpoint accepts one JPEG, PNG, WebP, or AVIF image up to B2_MAX_UPLOAD_BYTES (20 MiB by default). Signed URLs expire after B2_SIGNED_URL_TTL_SECONDS (15 minutes by default).

## Single-admin security
Apply database migration 002 before enabling admin authentication. It creates server-side sessions and a database constraint that permits only one admin row. Admin passwords are hashed with Node.js scrypt and a random salt; raw passwords are never stored. Session tokens are random, stored only as SHA-256 hashes, and delivered in HttpOnly, SameSite=Strict cookies (Secure in production). Login is rate-limited.

Provision the account once using the deployment environment's secret variables: DATABASE_URL, ADMIN_EMAIL, and ADMIN_PASSWORD (minimum 12 characters), then run npm run admin:create. Do not leave ADMIN_PASSWORD configured after provisioning. Do not expose the provisioning command as a public HTTP endpoint.

The content endpoints require DATABASE_URL. If it is not configured, they return HTTP 503 rather than pretending the database is available.

## Browser notification subscriptions
PUT /push-subscriptions stores browser subscriptions and channel choices only. Push delivery, VAPID key management, retries, and automatic publish triggers remain separate implementation work.

## Database
The initial schema is in database/migrations/001_initial_schema.sql. Migration 002 is database/migrations/002_single_admin_sessions.sql. Migration 008 ensures private-media URLs are nullable because temporary URLs must not be persisted. The production Neon database already has the corresponding nullable media columns. Never commit database credentials or admin secrets.

## Remaining implementation
- Admin announcement management APIs
- Admin photo deletion/editing UI and API
- Guest comments and moderation rules
- Browser push delivery and automatic publish triggers
- Automated API/integration tests
- Production hosting configuration and live deployment
- Pujari/admin contact workflow (not decided)
