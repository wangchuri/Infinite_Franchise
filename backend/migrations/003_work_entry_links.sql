-- Work ↔ Wiki entry links (reading annotations / writing fast-links)
CREATE TABLE IF NOT EXISTS work_entry_links (
  work_id    UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  entry_id   UUID NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (work_id, entry_id)
);

CREATE INDEX IF NOT EXISTS work_entry_links_entry_idx
  ON work_entry_links (entry_id);
