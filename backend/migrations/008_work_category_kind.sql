-- Work taxonomy: broad category (rail) + subtype/kind (tabs).
-- `type` stays as the structural enum (novel/chapter feed the reader);
-- category/kind drive browsing.
ALTER TABLE works
  ADD COLUMN IF NOT EXISTS category VARCHAR(32) NOT NULL DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS kind     VARCHAR(32) NOT NULL DEFAULT '';

UPDATE works SET category = 'novel', kind = 'short'   WHERE type = 'story';
UPDATE works SET category = 'novel', kind = 'long'    WHERE type = 'novel';
UPDATE works SET category = 'novel', kind = 'chapter' WHERE type = 'chapter';
UPDATE works SET category = 'artwork'                 WHERE type = 'artwork';
UPDATE works SET category = 'audio'                   WHERE type = 'audio';
UPDATE works SET category = 'video'                   WHERE type = 'video';
UPDATE works SET category = 'other'                   WHERE type = 'other';

-- Allow the new "program" structural type.
ALTER TABLE works DROP CONSTRAINT IF EXISTS works_type_check;
ALTER TABLE works ADD CONSTRAINT works_type_check
  CHECK (type IN (
    'novel','chapter','story','artwork','program','audio','video','other'
  ));

CREATE INDEX IF NOT EXISTS works_world_category_idx
  ON works (world_id, category, kind);
