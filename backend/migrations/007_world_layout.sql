-- World page layout (v2): author-composed, platform-rendered blocks.
-- Stored separately from homepage_config (legacy style config) so the
-- existing style editor keeps working while the block layout evolves.
ALTER TABLE worlds
  ADD COLUMN IF NOT EXISTS world_layout JSONB NOT NULL DEFAULT '{}'::jsonb;
