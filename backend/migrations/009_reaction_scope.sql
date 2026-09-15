-- Reaction system v2: data-driven, scoped reaction types + likes.
--
-- reaction_types gains a surrogate id + scope (global/world) + kind (emoji/artwork).
-- reactions now reference reaction_types(id) instead of the human key, so a
-- reaction can point either at a built-in emoji or at a custom artwork sticker.

-- 1. Extend reaction_types.
ALTER TABLE reaction_types
  ADD COLUMN IF NOT EXISTS id         UUID NOT NULL DEFAULT gen_random_uuid(),
  ADD COLUMN IF NOT EXISTS scope      VARCHAR(16) NOT NULL DEFAULT 'global'
             CHECK (scope IN ('global', 'world')),
  ADD COLUMN IF NOT EXISTS world_id   UUID REFERENCES worlds(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS kind       VARCHAR(16) NOT NULL DEFAULT 'emoji'
             CHECK (kind IN ('emoji', 'artwork')),
  ADD COLUMN IF NOT EXISTS artwork_id UUID REFERENCES works(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id);

-- 2. Add the new FK column and backfill it from the old key.
ALTER TABLE reactions ADD COLUMN IF NOT EXISTS reaction_type_id UUID;

UPDATE reactions r
   SET reaction_type_id = rt.id
  FROM reaction_types rt
 WHERE rt.key = r.reaction_type
   AND r.reaction_type_id IS NULL;

-- 3. Detach the old model (must happen before the PK swap, since the old FK
--    on reaction_type depends on reaction_types_pkey/key).
ALTER TABLE reactions
  DROP CONSTRAINT IF EXISTS reactions_user_id_target_type_target_id_reaction_type_key;
ALTER TABLE reactions DROP CONSTRAINT IF EXISTS reactions_reaction_type_fkey;
ALTER TABLE reactions DROP COLUMN IF EXISTS reaction_type;

-- 4. Swap the reaction_types primary key from `key` to the surrogate id.
ALTER TABLE reaction_types DROP CONSTRAINT IF EXISTS reaction_types_pkey;
ALTER TABLE reaction_types ADD CONSTRAINT reaction_types_pkey PRIMARY KEY (id);

-- 5. Reattach the new model.
ALTER TABLE reactions ALTER COLUMN reaction_type_id SET NOT NULL;
ALTER TABLE reactions
  ADD CONSTRAINT reactions_reaction_type_id_fkey
  FOREIGN KEY (reaction_type_id) REFERENCES reaction_types(id) ON DELETE CASCADE;
ALTER TABLE reactions
  ADD CONSTRAINT reactions_user_target_type_uidx
  UNIQUE (user_id, target_type, target_id, reaction_type_id);

CREATE INDEX IF NOT EXISTS reactions_type_idx ON reactions (reaction_type_id);

-- `key` stays a readable slug, unique within its scope.
CREATE UNIQUE INDEX IF NOT EXISTS reaction_types_global_key_uidx
  ON reaction_types (key) WHERE scope = 'global';
CREATE UNIQUE INDEX IF NOT EXISTS reaction_types_world_key_uidx
  ON reaction_types (world_id, key) WHERE scope = 'world';
