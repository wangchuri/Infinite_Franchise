import { pool } from "../db.js";
import type { MemberRole } from "./worlds.js";

export type InviteDirection = "invite" | "request";
export type InviteStatus = "pending" | "accepted" | "declined" | "revoked";

export type InboxInvite = {
  id: string;
  direction: InviteDirection;
  role: MemberRole;
  message: string | null;
  createdAt: string;
  worldId: string;
  worldName: string;
  worldSlug: string;
  worldVisibility: "public" | "private";
  actorId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorAvatarUrl: string | null;
};

export type SentInvite = {
  id: string;
  role: MemberRole;
  createdAt: string;
  inviteeId: string;
  inviteeUsername: string;
  inviteeDisplayName: string;
  inviteeAvatarUrl: string | null;
};

export type InboxNotification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  worldId: string | null;
  worldName: string | null;
  worldSlug: string | null;
  workId: string | null;
  workTitle: string | null;
  inviteId: string | null;
  actorId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
};

type InviteRow = {
  id: string;
  world_id: string;
  inviter_id: string;
  invitee_id: string;
  direction: InviteDirection;
  role: MemberRole;
  status: InviteStatus;
  message: string | null;
  created_at: Date;
};

const INVITE_SELECT = `
  SELECT i.id, i.direction, i.role, i.message, i.created_at,
         w.id   AS world_id,
         w.name AS world_name,
         w.slug AS world_slug,
         w.visibility AS world_visibility,
         u.id   AS actor_id,
         u.username AS actor_username,
         u.display_name AS actor_display_name,
         u.avatar_url AS actor_avatar_url
    FROM world_invites i
    JOIN worlds w ON w.id = i.world_id
    JOIN users  u ON u.id = i.inviter_id`;

function toInboxInvite(row: Record<string, unknown>): InboxInvite {
  return {
    id: row.id as string,
    direction: row.direction as InviteDirection,
    role: row.role as MemberRole,
    message: (row.message as string | null) ?? null,
    createdAt: new Date(row.created_at as string).toISOString(),
    worldId: row.world_id as string,
    worldName: (row.world_name as string) ?? "",
    worldSlug: (row.world_slug as string) ?? "",
    worldVisibility: (row.world_visibility as "public" | "private") ?? "public",
    actorId: row.actor_id as string,
    actorUsername: (row.actor_username as string) ?? "",
    actorDisplayName: (row.actor_display_name as string) ?? "",
    actorAvatarUrl: (row.actor_avatar_url as string | null) ?? null,
  };
}

/**
 * Create (or refresh) a pending invite/request. Idempotent per
 * (world, invitee, direction) while a pending row exists.
 */
export async function createInvite(input: {
  worldId: string;
  inviterId: string;
  inviteeId: string;
  role: MemberRole;
  direction?: InviteDirection;
  message?: string | null;
}): Promise<{ id: string } | null> {
  const res = await pool.query<{ id: string }>(
    `INSERT INTO world_invites
       (world_id, inviter_id, invitee_id, direction, role, message)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (world_id, invitee_id, direction) WHERE status = 'pending'
     DO UPDATE SET inviter_id = EXCLUDED.inviter_id,
                   role = EXCLUDED.role,
                   message = EXCLUDED.message,
                   created_at = now()
     RETURNING id`,
    [
      input.worldId,
      input.inviterId,
      input.inviteeId,
      input.direction ?? "invite",
      input.role,
      input.message?.trim().slice(0, 300) || null,
    ],
  );
  return res.rows[0] ?? null;
}

export async function findInvite(id: string): Promise<InviteRow | null> {
  const res = await pool.query<InviteRow>(
    `SELECT * FROM world_invites WHERE id = $1 LIMIT 1`,
    [id],
  );
  return res.rows[0] ?? null;
}

/** Invites/requests awaiting the current user's response. */
export async function listReceivedInvites(
  userId: string,
): Promise<InboxInvite[]> {
  const res = await pool.query(
    `${INVITE_SELECT}
      WHERE i.status = 'pending'
        AND (
          (i.direction = 'invite' AND i.invitee_id = $1)
          OR (i.direction = 'request' AND w.creator_id = $1)
        )
      ORDER BY i.created_at DESC`,
    [userId],
  );
  return res.rows.map(toInboxInvite);
}

/** Pending invites a world has sent out (for the owner's collab panel). */
export async function listSentInvites(worldId: string): Promise<SentInvite[]> {
  const res = await pool.query<{
    id: string;
    role: MemberRole;
    created_at: Date;
    invitee_id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  }>(
    `SELECT i.id, i.role, i.created_at,
            u.id AS invitee_id, u.username, u.display_name, u.avatar_url
       FROM world_invites i
       JOIN users u ON u.id = i.invitee_id
      WHERE i.world_id = $1
        AND i.direction = 'invite'
        AND i.status = 'pending'
      ORDER BY i.created_at DESC`,
    [worldId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    role: r.role,
    createdAt: new Date(r.created_at).toISOString(),
    inviteeId: r.invitee_id,
    inviteeUsername: r.username,
    inviteeDisplayName: r.display_name,
    inviteeAvatarUrl: r.avatar_url,
  }));
}

/** Pending join requests a world received (for the owner's collab panel). */
export async function listWorldRequests(worldId: string): Promise<InboxInvite[]> {
  const res = await pool.query(
    `${INVITE_SELECT}
      WHERE i.world_id = $1
        AND i.direction = 'request'
        AND i.status = 'pending'
      ORDER BY i.created_at DESC`,
    [worldId],
  );
  return res.rows.map(toInboxInvite);
}

export type RespondResult =
  | { ok: true; accepted: boolean }
  | { ok: false; reason: "not_found" | "forbidden" };

export async function respondToInvite(input: {
  inviteId: string;
  userId: string;
  accept: boolean;
}): Promise<RespondResult> {
  const invite = await findInvite(input.inviteId);
  if (!invite || invite.status !== "pending") {
    return { ok: false, reason: "not_found" };
  }
  const worldRes = await pool.query<{ creator_id: string }>(
    `SELECT creator_id FROM worlds WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [invite.world_id],
  );
  const creatorId = worldRes.rows[0]?.creator_id ?? null;
  const allowed =
    invite.direction === "invite"
      ? invite.invitee_id === input.userId
      : creatorId === input.userId;
  if (!allowed) return { ok: false, reason: "forbidden" };

  const status: InviteStatus = input.accept ? "accepted" : "declined";
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `UPDATE world_invites
          SET status = $2, responded_at = now()
        WHERE id = $1 AND status = 'pending'`,
      [invite.id, status],
    );
    if (input.accept) {
      await client.query(
        `INSERT INTO world_members (world_id, user_id, role)
         VALUES ($1, $2, $3)
         ON CONFLICT (world_id, user_id)
         DO UPDATE SET role = EXCLUDED.role, updated_at = now()`,
        [invite.world_id, invite.invitee_id, invite.role],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }

  // Tell the originator what happened (inviter, or the requester).
  await createNotification({
    userId: invite.inviter_id,
    type: input.accept ? "invite_accepted" : "invite_declined",
    actorId: input.userId,
    worldId: invite.world_id,
    inviteId: invite.id,
  });

  return { ok: true, accepted: input.accept };
}

/** Whether the user already has a live join request for the world. */
export async function hasPendingRequest(
  worldId: string,
  userId: string,
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM world_invites
      WHERE world_id = $1 AND invitee_id = $2
        AND direction = 'request' AND status = 'pending'
      LIMIT 1`,
    [worldId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** Owner cancels a pending invite they sent. */export async function revokeInvite(input: {
  inviteId: string;
  worldId: string;
}): Promise<boolean> {
  const res = await pool.query(
    `UPDATE world_invites
        SET status = 'revoked', responded_at = now()
      WHERE id = $1 AND world_id = $2
        AND direction = 'invite' AND status = 'pending'`,
    [input.inviteId, input.worldId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function createNotification(input: {
  userId: string;
  type: string;
  actorId?: string | null;
  worldId?: string | null;
  workId?: string | null;
  inviteId?: string | null;
  payload?: Record<string, unknown>;
}): Promise<void> {
  await pool.query(
    `INSERT INTO notifications
       (user_id, type, actor_id, world_id, work_id, invite_id, payload)
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)`,
    [
      input.userId,
      input.type,
      input.actorId ?? null,
      input.worldId ?? null,
      input.workId ?? null,
      input.inviteId ?? null,
      JSON.stringify(input.payload ?? {}),
    ],
  );
}

/** Notify a world's creator + editors (minus the actor) about a work. */
export async function notifyWorldReviewers(input: {
  worldId: string;
  actorId: string;
  type: string;
  workId: string;
  payload?: Record<string, unknown>;
}): Promise<void> {
  const res = await pool.query<{ user_id: string }>(
    `SELECT creator_id AS user_id FROM worlds WHERE id = $1
     UNION
     SELECT user_id FROM world_members
      WHERE world_id = $1 AND role IN ('creator', 'editor')`,
    [input.worldId],
  );
  const targets = new Set(res.rows.map((r) => r.user_id));
  targets.delete(input.actorId);
  await Promise.all(
    [...targets].map((userId) =>
      createNotification({
        userId,
        type: input.type,
        actorId: input.actorId,
        worldId: input.worldId,
        workId: input.workId,
        payload: input.payload,
      }),
    ),
  );
}

export async function listNotifications(
  userId: string,
  limit = 40,
): Promise<InboxNotification[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const res = await pool.query(
    `SELECT n.id, n.type, n.payload, n.read_at, n.created_at, n.invite_id,
            w.id AS world_id, w.name AS world_name, w.slug AS world_slug,
            k.id AS work_id, k.title AS work_title,
            u.id AS actor_id, u.username AS actor_username,
            u.display_name AS actor_display_name
       FROM notifications n
       LEFT JOIN worlds w ON w.id = n.world_id
       LEFT JOIN works  k ON k.id = n.work_id
       LEFT JOIN users  u ON u.id = n.actor_id
      WHERE n.user_id = $1
      ORDER BY n.created_at DESC
      LIMIT $2`,
    [userId, safeLimit],
  );
  return res.rows.map((row) => ({
    id: row.id as string,
    type: row.type as string,
    payload: (row.payload as Record<string, unknown>) ?? {},
    readAt: row.read_at ? new Date(row.read_at as string).toISOString() : null,
    createdAt: new Date(row.created_at as string).toISOString(),
    worldId: (row.world_id as string | null) ?? null,
    worldName: (row.world_name as string | null) ?? null,
    worldSlug: (row.world_slug as string | null) ?? null,
    workId: (row.work_id as string | null) ?? null,
    workTitle: (row.work_title as string | null) ?? null,
    inviteId: (row.invite_id as string | null) ?? null,
    actorId: (row.actor_id as string | null) ?? null,
    actorUsername: (row.actor_username as string | null) ?? null,
    actorDisplayName: (row.actor_display_name as string | null) ?? null,
  }));
}

/** Badge total: unread notifications + invites/requests awaiting response. */
export async function countUnread(userId: string): Promise<number> {
  const res = await pool.query<{ notif: string; invites: string }>(
    `SELECT
       (SELECT COUNT(*) FROM notifications
         WHERE user_id = $1 AND read_at IS NULL) AS notif,
       (SELECT COUNT(*) FROM world_invites i
          JOIN worlds w ON w.id = i.world_id
         WHERE i.status = 'pending'
           AND ((i.direction = 'invite' AND i.invitee_id = $1)
             OR (i.direction = 'request' AND w.creator_id = $1))) AS invites`,
    [userId],
  );
  const row = res.rows[0];
  return Number(row?.notif ?? 0) + Number(row?.invites ?? 0);
}

export async function markRead(userId: string, ids?: string[]): Promise<void> {
  if (ids && ids.length > 0) {
    await pool.query(
      `UPDATE notifications SET read_at = now()
        WHERE user_id = $1 AND read_at IS NULL AND id = ANY($2::uuid[])`,
      [userId, ids],
    );
    return;
  }
  await pool.query(
    `UPDATE notifications SET read_at = now()
      WHERE user_id = $1 AND read_at IS NULL`,
    [userId],
  );
}
