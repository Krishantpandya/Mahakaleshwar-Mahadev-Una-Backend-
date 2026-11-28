-- Private object storage uses temporary signed URLs at request time.
-- Never persist an expiring URL in the database.
-- This is safe to run when the columns are already nullable.
ALTER TABLE photos
    ALTER COLUMN media_url DROP NOT NULL;

ALTER TABLE announcements
    ALTER COLUMN poster_media_url DROP NOT NULL;
