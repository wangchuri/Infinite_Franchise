import { randomUUID } from "node:crypto";
import { pool } from "../db.js";
import {
  listReactionTypesForWorld,
  type ReactionDef,
} from "../config/reaction-config.js";

export const TARGET_TYPES = ["work", "entry", "timeline", "topic"] as const;
export type ReactionTargetType = (typeof TARGET_TYPES)[number];

export type ReactionSummary = {
  types: ReactionDef[];
  /** reaction_type_id → count */
  counts: Record<string, number>;
  /** reaction_type_ids the current viewer has reacted with */
  mine: string[];
};

export function isReactionTargetType(v: string): v is ReactionTargetType {
  return (TARGET_TYPES as readonly string[]).includes(v);
}

function targetTable(targetType: ReactionTargetType): string {
  return targetType === "work"
    ? "works"
    : targetType === "entry"
      ? "wiki_entries"
      : targetType === "timeline"
        ? "timeline_events"
        : "world_topics";
}

/** World a reaction target lives in (null when the target no longer exists). */
export async function resolveTargetWorld(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<string | null> {
  const table = targetTable(targetType);
  const res = await pool.query<{ world_id: string }>(
    `SELECT world_id FROM ${table}
      WHERE id = $1${targetType === "timeline" ? "" : " AND deleted_at IS NULL"}
      LIMIT 1`,
    [targetId],
  );
  return res.rows[0]?.world_id ?? null;
}

async function countByType(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<Map<string, number>> {
  const res = await pool.query<{ reaction_type_id: string; n: number }>(
    `SELECT reaction_type_id, count(*)::int AS n
       FROM reactions
      WHERE target_type = $1 AND target_id = $2
      GROUP BY reaction_type_id`,
    [targetType, targetId],
  );
  const map = new Map<string, number>();
  for (const row of res.rows) map.set(row.reaction_type_id, row.n);
  return map;
}

async function myReactions(
  userId: string,
  targetType: ReactionTargetType,
  targetId: string,
): Promise<Set<string>> {
  const res = await pool.query<{ reaction_type_id: string }>(
    `SELECT reaction_type_id FROM reactions
      WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
    [userId, targetType, targetId],
  );
  return new Set(res.rows.map((r) => r.reaction_type_id));
}

/**
 * A reaction type is usable on a target when it is a global built-in or a
 * custom reaction belonging to the target's own world.
 */
async function isTypeAllowed(
  reactionTypeId: string,
  worldId: string | null,
): Promise<boolean> {
  const res = await pool.query<{ one: number }>(
    `SELECT 1 AS one FROM reaction_types
      WHERE id = $1
        AND active = true
        AND (scope = 'global' OR (scope = 'world' AND world_id = $2))
      LIMIT 1`,
    [reactionTypeId, worldId],
  );
  return (res.rows[0]?.one ?? 0) === 1;
}

/** Counts + which types the current viewer has reacted with. */
export async function getReactionSummary(
  targetType: ReactionTargetType,
  targetId: string,
  userId: string | null,
): Promise<ReactionSummary> {
  const worldId = await resolveTargetWorld(targetType, targetId);
  const [types, counts, mine] = await Promise.all([
    listReactionTypesForWorld(worldId),
    countByType(targetType, targetId),
    userId
      ? myReactions(userId, targetType, targetId)
      : Promise.resolve(new Set<string>()),
  ]);
  return {
    types,
    counts: Object.fromEntries(counts),
    mine: userId ? [...mine] : [],
  };
}

/** Toggle a reaction; returns the updated summary. */
export async function toggleReaction(input: {
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  reactionTypeId: string;
}): Promise<ReactionSummary> {
  const worldId = await resolveTargetWorld(input.targetType, input.targetId);
  if (!(await isTypeAllowed(input.reactionTypeId, worldId))) {
    throw Object.assign(new Error("invalid reactionTypeId"), { statusCode: 400 });
  }
  const existing = await pool.query(
    `SELECT 1 FROM reactions
      WHERE user_id = $1 AND target_type = $2 AND target_id = $3
        AND reaction_type_id = $4`,
    [input.userId, input.targetType, input.targetId, input.reactionTypeId],
  );
  if ((existing.rowCount ?? 0) > 0) {
    await pool.query(
      `DELETE FROM reactions
        WHERE user_id = $1 AND target_type = $2 AND target_id = $3
          AND reaction_type_id = $4`,
      [input.userId, input.targetType, input.targetId, input.reactionTypeId],
    );
  } else {
    await pool.query(
      `INSERT INTO reactions (user_id, target_type, target_id, reaction_type_id)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, target_type, target_id, reaction_type_id)
       DO NOTHING`,
      [input.userId, input.targetType, input.targetId, input.reactionTypeId],
    );
  }
  return getReactionSummary(input.targetType, input.targetId, input.userId);
}

/** Remove a reaction; returns the updated summary. */
export async function removeReaction(input: {
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  reactionTypeId: string;
}): Promise<ReactionSummary> {
  await pool.query(
    `DELETE FROM reactions
      WHERE user_id = $1 AND target_type = $2 AND target_id = $3
        AND reaction_type_id = $4`,
    [input.userId, input.targetType, input.targetId, input.reactionTypeId],
  );
  return getReactionSummary(input.targetType, input.targetId, input.userId);
}

// —— World-scoped custom reaction types (emoji) ——

export const WORLD_REACTION_MAX = 20;

export type WorldReactionType = ReactionDef & { active: boolean };

type WorldReactionRow = {
  id: string;
  key: string;
  label: string;
  icon: string;
  description: string;
  sort_order: number;
  scope: "global" | "world";
  kind: "emoji" | "artwork";
  world_id: string | null;
  artwork_id: string | null;
  active: boolean;
};

function toWorldReactionType(r: WorldReactionRow): WorldReactionType {
  return {
    id: r.id,
    key: r.key,
    label: r.label,
    icon: r.icon,
    description: r.description,
    sortOrder: r.sort_order,
    scope: r.scope,
    kind: r.kind,
    worldId: r.world_id,
    artworkId: r.artwork_id,
    artworkUrl: null,
    active: r.active,
  };
}

const WORLD_REACTION_SELECT = `
  SELECT id, key, label, icon, description, sort_order, scope, kind,
         world_id, artwork_id, active
    FROM reaction_types
   WHERE scope = 'world' AND kind = 'emoji' AND world_id = $1`;

/** All custom emoji reactions owned by a world (for management). */
export async function listWorldReactionTypes(
  worldId: string,
): Promise<WorldReactionType[]> {
  const res = await pool.query<WorldReactionRow>(
    `${WORLD_REACTION_SELECT} ORDER BY sort_order ASC, created_at ASC`,
    [worldId],
  );
  return res.rows.map(toWorldReactionType);
}

export async function countWorldReactionTypes(worldId: string): Promise<number> {
  const res = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM reaction_types
      WHERE scope = 'world' AND kind = 'emoji' AND world_id = $1`,
    [worldId],
  );
  return res.rows[0]?.n ?? 0;
}

export async function createWorldReactionType(input: {
  worldId: string;
  userId: string;
  label: string;
  icon: string;
}): Promise<WorldReactionType> {
  const key = `w_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const res = await pool.query<WorldReactionRow>(
    `INSERT INTO reaction_types
       (key, label, icon, description, sort_order, scope, kind, world_id, created_by, active)
     VALUES (
       $1, $2, $3, '', 
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM reaction_types
         WHERE scope = 'world' AND world_id = $4),
       'world', 'emoji', $4, $5, true
     )
     RETURNING id, key, label, icon, description, sort_order, scope, kind,
               world_id, artwork_id, active`,
    [key, input.label, input.icon, input.worldId, input.userId],
  );
  return toWorldReactionType(res.rows[0]);
}

export async function updateWorldReactionType(input: {
  id: string;
  worldId: string;
  label?: string;
  icon?: string;
  active?: boolean;
  sortOrder?: number;
}): Promise<WorldReactionType | null> {
  const res = await pool.query<WorldReactionRow>(
    `UPDATE reaction_types
        SET label      = COALESCE($3, label),
            icon       = COALESCE($4, icon),
            active     = COALESCE($5, active),
            sort_order = COALESCE($6, sort_order),
            updated_at = now()
      WHERE id = $1 AND scope = 'world' AND world_id = $2
      RETURNING id, key, label, icon, description, sort_order, scope, kind,
                world_id, artwork_id, active`,
    [
      input.id,
      input.worldId,
      input.label ?? null,
      input.icon ?? null,
      input.active ?? null,
      input.sortOrder ?? null,
    ],
  );
  return res.rows[0] ? toWorldReactionType(res.rows[0]) : null;
}

export async function deleteWorldReactionType(
  id: string,
  worldId: string,
): Promise<boolean> {
  const res = await pool.query(
    `DELETE FROM reaction_types
      WHERE id = $1 AND scope = 'world' AND world_id = $2`,
    [id, worldId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function assertTargetExists(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<boolean> {
  const table = targetTable(targetType);
  const res = await pool.query<{ one: number }>(
    `SELECT 1 AS one FROM ${table}
      WHERE id = $1${targetType === "timeline" ? "" : " AND deleted_at IS NULL"}
      LIMIT 1`,
    [targetId],
  );
  return (res.rows[0]?.one ?? 0) === 1;
}
