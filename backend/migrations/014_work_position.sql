-- Manual chapter ordering for novels (outline order).
ALTER TABLE works ADD COLUMN IF NOT EXISTS position INT NOT NULL DEFAULT 0;

-- Backfill existing chapters by creation order within each novel.
WITH ranked AS (
  SELECT id,
         row_number() OVER (PARTITION BY parent_id ORDER BY created_at) - 1 AS pos
    FROM works
   WHERE parent_id IS NOT NULL
)
UPDATE works w
   SET position = r.pos
  FROM ranked r
 WHERE w.id = r.id;
