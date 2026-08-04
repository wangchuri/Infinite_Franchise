-- Batch A · MVP foundation
-- Infinite Franchise · infinite_franchise

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE IF NOT EXISTS schema_migrations (
  id          TEXT PRIMARY KEY,
  applied_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username           VARCHAR(32)  NOT NULL,
  email              VARCHAR(255) NOT NULL,
  email_verified_at  TIMESTAMPTZ,
  password_hash      TEXT         NOT NULL,
  display_name       VARCHAR(64)  NOT NULL,
  avatar_url         TEXT,
  bio                VARCHAR(500),
  status             VARCHAR(16)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'disabled', 'banned')),
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS users_username_active_uidx
  ON users (lower(username)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS users_email_active_uidx
  ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS users_status_idx ON users (status);

CREATE TABLE IF NOT EXISTS user_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  refresh_token_hash  TEXT NOT NULL,
  user_agent          TEXT,
  ip                  INET,
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS user_sessions_token_uidx
  ON user_sessions (refresh_token_hash);
CREATE INDEX IF NOT EXISTS user_sessions_user_idx ON user_sessions (user_id);
CREATE INDEX IF NOT EXISTS user_sessions_expires_idx ON user_sessions (expires_at);

CREATE TABLE IF NOT EXISTS worlds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES users(id),
  parent_world_id  UUID REFERENCES worlds(id),
  name             VARCHAR(80) NOT NULL,
  slug             VARCHAR(80) NOT NULL,
  description      VARCHAR(500) NOT NULL DEFAULT '',
  cover_url        TEXT,
  welcome_message  TEXT,
  visibility       VARCHAR(16) NOT NULL DEFAULT 'public'
                   CHECK (visibility IN ('public', 'private')),
  allow_fork       BOOLEAN NOT NULL DEFAULT true,
  homepage_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS worlds_slug_active_uidx
  ON worlds (slug) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS worlds_creator_idx ON worlds (creator_id);
CREATE INDEX IF NOT EXISTS worlds_public_updated_idx
  ON worlds (visibility, updated_at DESC);

CREATE TABLE IF NOT EXISTS world_permissions (
  world_id          UUID PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  work_submit_mode  VARCHAR(32) NOT NULL DEFAULT 'review'
                    CHECK (work_submit_mode IN ('open', 'review', 'invite_only')),
  wiki_edit_mode    VARCHAR(32) NOT NULL DEFAULT 'editors'
                    CHECK (wiki_edit_mode IN (
                      'creator_only', 'editors', 'all_members', 'draft_only'
                    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS world_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id   UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  role       VARCHAR(32) NOT NULL
             CHECK (role IN ('creator', 'editor', 'contributor', 'viewer')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (world_id, user_id)
);

CREATE INDEX IF NOT EXISTS world_members_user_idx ON world_members (user_id);
CREATE INDEX IF NOT EXISTS world_members_world_role_idx ON world_members (world_id, role);

CREATE TABLE IF NOT EXISTS world_follows (
  user_id       UUID NOT NULL REFERENCES users(id),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notify_works  BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, world_id)
);

CREATE INDEX IF NOT EXISTS world_follows_user_idx
  ON world_follows (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS world_follows_world_idx ON world_follows (world_id);

CREATE TABLE IF NOT EXISTS works (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id       UUID NOT NULL REFERENCES worlds(id),
  author_id      UUID NOT NULL REFERENCES users(id),
  type           VARCHAR(32) NOT NULL,
  title          VARCHAR(200) NOT NULL,
  summary        VARCHAR(500),
  content        TEXT,
  media_url      TEXT,
  status         VARCHAR(16) NOT NULL DEFAULT 'draft',
  parent_id      UUID REFERENCES works(id),
  reviewed_by    UUID REFERENCES users(id),
  reviewed_at    TIMESTAMPTZ,
  reject_reason  VARCHAR(500),
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  CHECK (type IN ('novel','chapter','story','artwork','audio','video','other')),
  CHECK (status IN ('draft','pending','published','rejected'))
);

CREATE INDEX IF NOT EXISTS works_world_published_idx
  ON works (world_id, status, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS works_feed_idx
  ON works (status, published_at DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS works_author_idx
  ON works (author_id, created_at DESC);
CREATE INDEX IF NOT EXISTS works_parent_idx ON works (parent_id);

CREATE TABLE IF NOT EXISTS work_likes (
  user_id    UUID NOT NULL REFERENCES users(id),
  work_id    UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);

CREATE INDEX IF NOT EXISTS work_likes_work_idx
  ON work_likes (work_id, created_at DESC);
