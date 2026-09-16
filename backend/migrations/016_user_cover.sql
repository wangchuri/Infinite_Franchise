-- Public profile cover image.
ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_url TEXT;
