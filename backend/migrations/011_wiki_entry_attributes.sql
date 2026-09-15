-- Entry structured attributes: per-category extra fields (角色身份/年龄/所属…)
-- used by region card variants to render conditionally (e.g. NPC cards).
ALTER TABLE wiki_entries
  ADD COLUMN IF NOT EXISTS attributes JSONB NOT NULL DEFAULT '{}'::jsonb;
