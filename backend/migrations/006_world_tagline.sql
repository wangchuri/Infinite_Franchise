-- World tagline: a one-line pitch shown on the Wiki hero.
ALTER TABLE worlds
  ADD COLUMN IF NOT EXISTS tagline VARCHAR(140) NOT NULL DEFAULT '';
