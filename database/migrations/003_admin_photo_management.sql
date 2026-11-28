-- Separate selected calendar photo date from actual upload timestamp.
-- Apply after 002_single_admin_sessions.sql.
BEGIN;
ALTER TABLE photos ADD COLUMN photo_date DATE, ADD COLUMN original_filename TEXT, ADD COLUMN uploaded_at TIMESTAMPTZ;
UPDATE photos SET photo_date=COALESCE((taken_at AT TIME ZONE 'UTC')::date,(created_at AT TIME ZONE 'UTC')::date), uploaded_at=created_at;
ALTER TABLE photos ALTER COLUMN photo_date SET NOT NULL, ALTER COLUMN photo_date SET DEFAULT CURRENT_DATE, ALTER COLUMN uploaded_at SET NOT NULL, ALTER COLUMN uploaded_at SET DEFAULT NOW();
ALTER TABLE photos ADD CONSTRAINT photos_original_filename_not_empty CHECK (original_filename IS NULL OR length(trim(original_filename))>0);
CREATE INDEX photos_photo_date_idx ON photos(photo_date DESC,id DESC);
CREATE INDEX photos_admin_status_idx ON photos(published_at,uploaded_at DESC);
COMMIT;