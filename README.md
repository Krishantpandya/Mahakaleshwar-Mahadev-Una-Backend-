# Mankaleshwar Mahadev Backend

TypeScript API service for the Mankaleshwar Mahadev Temple website.

## Stack
- Node.js 22+
- Fastify 5 and TypeScript
- PostgreSQL 17 hosted on Neon
- Railway Volume for persistent photo files (temporary provider; designed for a later B2 migration)
- Optional Backblaze B2 private object storage for future migration and announcement posters
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
| GET | /photos | List published photos; returns absolute media URLs from the API |
| GET | /photos/:photoId/media | Stream a published photo inline |
| GET | /photos/:photoId/download | Download a published photo as an attachment |
| POST | /photos/:photoId/likes | Add an idempotent guest like using a client-generated visitorId UUID |
| GET | /announcements | List published announcements and sign private poster URLs when B2 poster storage is configured |
| POST | /admin/photos | Upload and publish one image to Railway persistent storage; requires admin session cookie and multipart form data |
| POST | /admin/auth/login | Authenticate the single admin and issue an HttpOnly session cookie |
| POST | /admin/auth/logout | Revoke the current admin session |
| GET | /admin/auth/me | Check the current admin session |
| PUT | /push-subscriptions | Register/update a browser push subscription for one or both notification channels |

## Railway persistent photo storage (temporary provider)
The production backend stores uploaded photo binaries in a Railway Volume mounted at `/data`. The application writes files below `MEDIA_STORAGE_DIR` (set to `/data` in Railway) using keys such as `media/photos/<photo-id>/<filename>`. Neon stores only photo metadata and the relative storage key; image bytes are never written to Postgres.

Required Railway configuration:
- Attach a persistent Volume to the `mankaleshwar-backend` service.
- Mount path: `/data`.
- Set `MEDIA_STORAGE_DIR=/data`.
- Keep the service at one replica. Railway volumes are attached to a single service instance and are not shared across multiple replicas or regions.
- The volume must be mounted at runtime; do not try to write uploads during the image build.
- Back up important photos separately. Volume storage is persistent across deploys/restarts, but it is not a substitute for an independent backup.

The upload endpoint accepts one JPEG, PNG, WebP, or AVIF image up to `MAX_UPLOAD_BYTES` (20 MiB by default). Uploads remain admin-authenticated and rate-limited. Published photo files are streamed through API endpoints; storage paths are never exposed to visitors.

For local development, `MEDIA_STORAGE_DIR=./data` writes files into a local `data` directory. Do not commit uploaded files.

## Future Backblaze B2 migration
The Railway filesystem provider is intentionally isolated in `src/storage/railway-volume.ts`. To migrate later, implement the same storage operations with the B2 provider and switch the configured provider without changing the photo database schema or public API contract. Existing Railway files must be copied to B2 before switching; changing providers alone does not move existing image bytes.

B2 configuration fields are retained for that future migration. Use a standard application key restricted to the single media bucket, never the account master key. Do not put B2 credentials in frontend code or source control. The bucket should remain private and public delivery should use short-lived signed URLs.

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
- Pujari/admin contact workflow (not decided)
