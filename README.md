# Mankaleshwar Mahadev Backend

TypeScript API service for the Mankaleshwar Mahadev Temple website.

## Stack

- Node.js 22+
- Fastify 5 and TypeScript
- PostgreSQL 17 hosted on Neon
- Zod request and environment validation

## Run locally

1. Copy `.env.example` to `.env`.
2. Set `DATABASE_URL` to a PostgreSQL connection string (use a pooled Neon URL for API traffic).
3. Install dependencies with `npm install`.
4. Run `npm run dev`.

## Commands

- `npm run dev` — development server with reload
- `npm run typecheck` — TypeScript type checking
- `npm run build` — compile to `dist/`
- `npm start` — run compiled server

## API v1

All endpoints are under `/api/v1`.

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/health` | Process health check |
| GET | `/photos` | List published photos; supports `from`, `to`, `limit`, `offset` |
| POST | `/photos/:photoId/likes` | Add an idempotent guest like using a client-generated `visitorId` UUID |
| GET | `/announcements` | List published announcements; supports `limit`, `offset` |
| PUT | `/push-subscriptions` | Register/update a browser push subscription for one or both notification channels |

The content endpoints require `DATABASE_URL`. If it is not configured, they return HTTP 503 rather than pretending the database is available.

### Guest likes

Send JSON `{ "visitorId": "<uuid>" }` to `POST /api/v1/photos/:photoId/likes`. The database enforces one like per visitor UUID per photo. A visitor UUID is an opaque browser-generated identifier, not a visitor account. Like removal is not implemented because that behavior has not been decided.

### Browser notification subscriptions

Send a browser Push API subscription as JSON with `endpoint`, `keys.p256dh`, `keys.auth`, and a `channels` array containing `photos`, `announcements`, or both to `PUT /api/v1/push-subscriptions`. The endpoint updates the subscription and replaces its channel selections atomically. This stores subscriptions only; push delivery, VAPID key management, retries, and automatic publish triggers are not implemented yet.

## Database

The initial PostgreSQL schema is in `database/migrations/001_initial_schema.sql`. It has been applied to the Neon project `mankaleshwar-mahadev` (PostgreSQL 17, AWS Singapore region) and verified to contain these tables:

- `admins`
- `photos`
- `photo_likes`
- `photo_comments`
- `announcements`
- `push_subscriptions`
- `push_subscription_channels`

The database connection string is a secret and is not committed to this repository. Configure it as `DATABASE_URL` in the backend hosting environment before deploying the API.

## Not implemented yet

- Admin authentication, roles, and permissions (requirements need confirmation)
- Admin photo/announcement create, edit, publish, and delete APIs
- Media upload/storage provider integration
- Guest comments (moderation and abuse rules are not decided)
- Browser push subscription endpoints and delivery provider integration
- Automatic notifications after publishing
- Automated tests and production deployment configuration

Do not expose admin write endpoints until authentication and authorization are implemented.
