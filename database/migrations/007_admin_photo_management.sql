-- Add the admin photo-management fields required by the current API.
-- Earlier migrations 001-006 are already present in the existing Neon database.
BEGIN;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS photo_date DATE;
ALTER TABLE photos ADD COLUMN IF NOT EXISTS original_filename TEXT;
UPDATE photos
SET photo_date = COALESCE(photo_date, (taken_at AT TIME ZONE 'UTC')::date, (created_at AT TIME ZONE 'UTC')::date),
    uploaded_at = COALESCE(uploaded_at, created_at);
ALTER TABLE photos ALTER COLUMN photo_date SET DEFAULT CURRENT_DATE;
ALTER TABLE photos ALTER COLUMN photo_date SET NOT NULL;
ALTER TABLE photos ALTER COLUMN uploaded_at SET DEFAULT NOW();
ALTER TABLE photos ALTER COLUMN uploaded_at SET NOT NULL;
ALTER TABLE photos ADD CONSTRAINT photos_original_filename_not_empty
  CHECK (original_filename IS NULL OR length(trim(original_filename)) > 0);
CREATE INDEX IF NOT EXISTS photos_photo_date_idx ON photos (photo_date DESC, id DESC);
CREATE INDEX IF NOT EXISTS photos_admin_status_idx ON photos (published_at, uploaded_at DESC);
COMMIT;
