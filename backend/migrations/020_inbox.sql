-- Inbox · world invitations / join requests and notifications
-- Infinite Franchise · inbox

-- A pending invite (world -> user) or join request (user -> world).
-- role is the membership role granted on acceptance.
CREATE TABLE IF NOT EXISTS world_invites (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id     UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  inviter_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  invitee_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  direction    VARCHAR(16) NOT NULL DEFAULT 'invite'
               CHECK (direction IN ('invite', 'request')),
  role         VARCHAR(32) NOT NULL DEFAULT 'contributor'
               CHECK (role IN ('editor', 'contributor', 'viewer')),
  status       VARCHAR(16) NOT NULL DEFAULT 'pending'
               CHECK (status IN ('pending', 'accepted', 'declined', 'revoked')),
  message      VARCHAR(300),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

-- Only one live invitation per (world, user, direction).
CREATE UNIQUE INDEX IF NOT EXISTS world_invites_pending_uidx
  ON world_invites (world_id, invitee_id, direction)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS world_invites_invitee_idx
  ON world_invites (invitee_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS world_invites_world_idx
  ON world_invites (world_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS notifications (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(32) NOT NULL,
  actor_id   UUID REFERENCES users(id) ON DELETE SET NULL,
  world_id   UUID REFERENCES worlds(id) ON DELETE CASCADE,
  work_id    UUID REFERENCES works(id) ON DELETE CASCADE,
  invite_id  UUID REFERENCES world_invites(id) ON DELETE CASCADE,
  payload    JSONB NOT NULL DEFAULT '{}'::jsonb,
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS notifications_user_idx
  ON notifications (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_unread_idx
  ON notifications (user_id) WHERE read_at IS NULL;
