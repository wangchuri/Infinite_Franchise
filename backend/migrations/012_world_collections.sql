-- Author-defined collections (归属) replacing the fixed entry category enum.
-- Each world seeds the built-in collections; authors may add custom ones,
-- rename/hide built-ins, but not delete built-ins.
CREATE TABLE IF NOT EXISTS world_collections (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id    UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  key         VARCHAR(40) NOT NULL,
  name        VARCHAR(60) NOT NULL,
  icon_url    TEXT,
  color       VARCHAR(16),
  attr_fields JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order  INT NOT NULL DEFAULT 0,
  hidden      BOOLEAN NOT NULL DEFAULT false,
  is_builtin  BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS world_collections_world_key_uidx
  ON world_collections (world_id, key);
CREATE INDEX IF NOT EXISTS world_collections_world_sort_idx
  ON world_collections (world_id, sort_order);

-- `category` is now an author-defined collection key; drop the fixed CHECK.
ALTER TABLE wiki_entries
  DROP CONSTRAINT IF EXISTS wiki_entries_category_check;

-- Seed the built-in collections for every existing world.
INSERT INTO world_collections (world_id, key, name, sort_order, is_builtin)
SELECT w.id, d.key, d.name, d.ord, true
FROM worlds w
CROSS JOIN (VALUES
  ('character', '人物', 0),
  ('location', '地点', 1),
  ('item', '物品', 2),
  ('organization', '组织', 3),
  ('event', '事件', 4),
  ('concept', '概念', 5),
  ('other', '其他', 6)
) AS d(key, name, ord)
WHERE w.deleted_at IS NULL
ON CONFLICT (world_id, key) DO NOTHING;
