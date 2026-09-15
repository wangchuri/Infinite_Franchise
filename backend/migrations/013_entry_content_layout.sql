-- Entry body layout: a flat list of content blocks (headings, images, …),
-- rendered instead of the Markdown `content` when non-empty.
ALTER TABLE wiki_entries
  ADD COLUMN IF NOT EXISTS content_layout JSONB NOT NULL
  DEFAULT '{"version":2,"blocks":[]}'::jsonb;
