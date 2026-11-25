-- Single-admin authentication and server-side sessions.
-- Apply after 001_initial_schema.sql. Existing admin rows are preserved;
-- this constraint intentionally prevents adding a second account.
BEGIN;
CREATE UNIQUE INDEX admins_single_account_only ON admins ((true));
CREATE TABLE admin_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES admins(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT admin_sessions_token_hash_not_empty CHECK (length(trim(token_hash)) > 0)
);
CREATE INDEX admin_sessions_admin_id_idx ON admin_sessions (admin_id);
CREATE INDEX admin_sessions_expires_at_idx ON admin_sessions (expires_at);
COMMIT;
