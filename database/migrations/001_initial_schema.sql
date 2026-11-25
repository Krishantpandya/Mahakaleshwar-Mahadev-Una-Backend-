-- Mankaleshwar Mahadev — initial PostgreSQL schema
-- PostgreSQL 15+
-- Apply this file once to an empty database. Keep future changes in new,
-- ordered migration files; do not edit an already-applied migration.

BEGIN;

CREATE TYPE notification_channel AS ENUM ('photos', 'announcements');

CREATE TABLE admins (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT admins_email_not_empty CHECK (length(trim(email)) > 0),
    CONSTRAINT admins_password_hash_not_empty CHECK (length(trim(password_hash)) > 0)
);

CREATE UNIQUE INDEX admins_email_lower_unique ON admins (lower(email));

CREATE TABLE photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    storage_key TEXT NOT NULL,
    media_url TEXT NOT NULL,
    mime_type TEXT NOT NULL,
    file_size_bytes BIGINT,
    caption TEXT,
    taken_at TIMESTAMPTZ,
    published_at TIMESTAMPTZ,
    created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT photos_storage_key_not_empty CHECK (length(trim(storage_key)) > 0),
    CONSTRAINT photos_media_url_not_empty CHECK (length(trim(media_url)) > 0),
    CONSTRAINT photos_mime_type_not_empty CHECK (length(trim(mime_type)) > 0),
    CONSTRAINT photos_file_size_nonnegative CHECK (file_size_bytes IS NULL OR file_size_bytes >= 0)
);

CREATE INDEX photos_published_at_idx ON photos (published_at DESC)
    WHERE published_at IS NOT NULL;
CREATE INDEX photos_taken_at_idx ON photos (taken_at DESC);

-- A visitor_id is an opaque UUID generated and retained by the client.
-- It is not a website account and does not identify a real-world person.
CREATE TABLE photo_likes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    visitor_id UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT photo_likes_one_per_visitor UNIQUE (photo_id, visitor_id)
);

CREATE INDEX photo_likes_photo_id_idx ON photo_likes (photo_id);

CREATE TABLE photo_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    photo_id UUID NOT NULL REFERENCES photos(id) ON DELETE CASCADE,
    visitor_id UUID NOT NULL,
    body TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT photo_comments_body_not_empty CHECK (length(trim(body)) > 0),
    CONSTRAINT photo_comments_body_max_length CHECK (char_length(body) <= 2000)
);

CREATE INDEX photo_comments_photo_created_idx
    ON photo_comments (photo_id, created_at DESC);

CREATE TABLE announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT,
    message TEXT,
    poster_storage_key TEXT,
    poster_media_url TEXT,
    published_at TIMESTAMPTZ,
    created_by_admin_id UUID REFERENCES admins(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT announcements_title_not_empty
        CHECK (title IS NULL OR length(trim(title)) > 0),
    CONSTRAINT announcements_message_not_empty
        CHECK (message IS NULL OR length(trim(message)) > 0),
    CONSTRAINT announcements_poster_key_not_empty
        CHECK (poster_storage_key IS NULL OR length(trim(poster_storage_key)) > 0),
    CONSTRAINT announcements_poster_url_not_empty
        CHECK (poster_media_url IS NULL OR length(trim(poster_media_url)) > 0),
    CONSTRAINT announcements_content_required
        CHECK (
            (message IS NOT NULL AND length(trim(message)) > 0)
            OR
            (poster_storage_key IS NOT NULL AND poster_media_url IS NOT NULL)
        ),
    CONSTRAINT announcements_poster_fields_paired
        CHECK (
            (poster_storage_key IS NULL AND poster_media_url IS NULL)
            OR
            (poster_storage_key IS NOT NULL AND poster_media_url IS NOT NULL)
        )
);

CREATE INDEX announcements_published_at_idx ON announcements (published_at DESC)
    WHERE published_at IS NOT NULL;

-- One browser push endpoint can subscribe to either or both independent channels.
-- Push delivery provider and lifecycle policy are intentionally not encoded here.
CREATE TABLE push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT push_endpoint_not_empty CHECK (length(trim(endpoint)) > 0),
    CONSTRAINT push_p256dh_not_empty CHECK (length(trim(p256dh_key)) > 0),
    CONSTRAINT push_auth_not_empty CHECK (length(trim(auth_key)) > 0)
);

CREATE TABLE push_subscription_channels (
    push_subscription_id UUID NOT NULL
        REFERENCES push_subscriptions(id) ON DELETE CASCADE,
    channel notification_channel NOT NULL,
    subscribed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (push_subscription_id, channel)
);

COMMIT;
