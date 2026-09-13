import { pool } from "../db.js";
import {
  type MemberRole,
  type WorldRow,
  type WorkSubmitMode,
  attachWorkSubmitMode,
} from "./worlds.js";

export type WorldPermissionsRow = {
  world_id: string;
  work_submit_mode: WorkSubmitMode;
  wiki_edit_mode: string;
};

/** Fetch world_permissions, creating a default row on first access. */
export async function getWorldPermissions(
  worldId: string,
): Promise<WorldPermissionsRow> {
  await pool.query(
    `INSERT INTO world_permissions (world_id)
     VALUES ($1) ON CONFLICT (world_id) DO NOTHING`,
    [worldId],
  );
  const res = await pool.query<WorldPermissionsRow>(
    `SELECT * FROM world_permissions WHERE world_id = $1`,
    [worldId],
  );
  return res.rows[0];
}

export async function getWorkSubmitMode(
  worldId: string,
): Promise<WorkSubmitMode> {
  const perms = await getWorldPermissions(worldId);
  return perms.work_submit_mode;
}

export async function getMemberRole(
  worldId: string,
  userId: string,
): Promise<MemberRole | null> {
  const res = await pool.query<{ role: MemberRole }>(
    `SELECT role FROM world_members
      WHERE world_id = $1 AND user_id = $2 LIMIT 1`,
    [worldId, userId],
  );
  return res.rows[0]?.role ?? null;
}

export type MemberItem = {
  userId: string;
  username: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
};

export async function listMembers(worldId: string): Promise<MemberItem[]> {
  const res = await pool.query<{
    user_id: string;
    username: string;
    display_name: string;
    role: MemberRole;
    joined_at: Date;
  }>(
    `SELECT m.user_id, u.username, u.display_name, m.role, m.joined_at
       FROM world_members m
       JOIN users u ON u.id = m.user_id
      WHERE m.world_id = $1
      ORDER BY m.joined_at ASC`,
    [worldId],
  );
  return res.rows.map((r) => ({
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name,
    role: r.role,
    joinedAt: r.joined_at.toISOString(),
  }));
}

export async function addMember(
  worldId: string,
  userId: string,
  role: MemberRole,
): Promise<MemberItem | null> {
  const res = await pool.query(
    `INSERT INTO world_members (world_id, user_id, role)
     VALUES ($1, $2, $3)
     ON CONFLICT (world_id, user_id)
     DO UPDATE SET role = EXCLUDED.role, updated_at = now()
     RETURNING user_id`,
    [worldId, userId, role],
  );
  if (!res.rows[0]) return null;
  const list = await listMembers(worldId);
  return list.find((m) => m.userId === userId) ?? null;
}

/** Returns false if the creator/self cannot be removed. */
export async function removeMember(
  worldId: string,
  userId: string,
  actorUserId: string,
): Promise<boolean> {
  if (userId === actorUserId) return false;
  const role = await getMemberRole(worldId, userId);
  if (role === "creator") return false;
  const res = await pool.query(
    `DELETE FROM world_members
      WHERE world_id = $1 AND user_id = $2 AND role <> 'creator'`,
    [worldId, userId],
  );
  return (res.rowCount ?? 0) > 0;
}

/** 谁能在这个世界投稿作品。 */
export function canCreateWorks(input: {
  world: WorldRow;
  mode: WorkSubmitMode;
  role: MemberRole | null;
  userId: string;
}): boolean {
  if (input.world.creator_id === input.userId) return true;
  if (input.mode === "open" || input.mode === "review") return true;
  // invite_only：仅成员（contributor / editor）可写
  return input.role === "contributor" || input.role === "editor";
}

/** 谁能审核 pending 作品：创建者或 editor。 */
export function canReviewWorks(input: {
  world: WorldRow;
  role: MemberRole | null;
  userId: string;
}): boolean {
  if (input.world.creator_id === input.userId) return true;
  return input.role === "editor";
}

/** 用户可投稿的世界：我的 + 公开(open/review) + 我是成员的世界。 */
export async function listContributableWorlds(
  userId: string,
): Promise<WorldRow[]> {
  const res = await pool.query<WorldRow>(
    `SELECT DISTINCT w.*
       FROM worlds w
       LEFT JOIN world_members m ON m.world_id = w.id AND m.user_id = $1
       LEFT JOIN world_permissions p ON p.world_id = w.id
      WHERE w.deleted_at IS NULL
        AND (
          w.creator_id = $1
          OR (
            w.status = 'published'
            AND w.visibility = 'public'
            AND p.work_submit_mode IN ('open', 'review')
          )
          OR m.user_id IS NOT NULL
        )
      ORDER BY w.updated_at DESC`,
    [userId],
  );
  await attachWorkSubmitMode(res.rows);
  return res.rows;
}
