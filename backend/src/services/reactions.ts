import { pool } from "../db.js";
import {
  listActiveReactionTypes,
  type ReactionDef,
} from "../config/reaction-config.js";

export const TARGET_TYPES = ["work", "entry", "timeline"] as const;
export type ReactionTargetType = (typeof TARGET_TYPES)[number];

export type ReactionSummary = {
  types: ReactionDef[];
  counts: Record<string, number>;
  mine: string[];
};

export function isReactionTargetType(v: string): v is ReactionTargetType {
  return (TARGET_TYPES as readonly string[]).includes(v);
}

async function countByType(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<Map<string, number>> {
  const res = await pool.query<{ reaction_type: string; n: number }>(
    `SELECT reaction_type, count(*)::int AS n
       FROM reactions
      WHERE target_type = $1 AND target_id = $2
      GROUP BY reaction_type`,
    [targetType, targetId],
  );
  const map = new Map<string, number>();
  for (const row of res.rows) map.set(row.reaction_type, row.n);
  return map;
}

async function myReactions(
  userId: string,
  targetType: ReactionTargetType,
  targetId: string,
): Promise<Set<string>> {
  const res = await pool.query<{ reaction_type: string }>(
    `SELECT reaction_type FROM reactions
      WHERE user_id = $1 AND target_type = $2 AND target_id = $3`,
    [userId, targetType, targetId],
  );
  return new Set(res.rows.map((r) => r.reaction_type));
}

/** Counts + which types the current viewer has reacted with. */
export async function getReactionSummary(
  targetType: ReactionTargetType,
  targetId: string,
  userId: string | null,
): Promise<ReactionSummary> {
  const [types, counts, mine] = await Promise.all([
    listActiveReactionTypes(),
    countByType(targetType, targetId),
    userId ? myReactions(userId, targetType, targetId) : Promise.resolve(new Set<string>()),
  ]);
  return {
    types,
    counts: Object.fromEntries(types.map((t) => [t.key, counts.get(t.key) ?? 0])),
    mine: userId ? [...mine] : [],
  };
}

/** Toggle a reaction; returns the updated summary. */
export async function toggleReaction(input: {
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  reactionType: string;
}): Promise<ReactionSummary> {
  await pool.query(
    `INSERT INTO reactions (user_id, target_type, target_id, reaction_type)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id, target_type, target_id, reaction_type)
     DO NOTHING`,
    [input.userId, input.targetType, input.targetId, input.reactionType],
  );
  return getReactionSummary(input.targetType, input.targetId, input.userId);
}

/** Remove a reaction; returns the updated summary. */
export async function removeReaction(input: {
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  reactionType: string;
}): Promise<ReactionSummary> {
  await pool.query(
    `DELETE FROM reactions
      WHERE user_id = $1 AND target_type = $2 AND target_id = $3
        AND reaction_type = $4`,
    [input.userId, input.targetType, input.targetId, input.reactionType],
  );
  return getReactionSummary(input.targetType, input.targetId, input.userId);
}

async function targetExists(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<boolean> {
  const table =
    targetType === "work"
      ? "works"
      : targetType === "entry"
        ? "wiki_entries"
        : "timeline_events";
  // timeline_events has no deleted_at column.
  const res = await pool.query<{ one: number }>(
    `SELECT 1 AS one FROM ${table}
      WHERE id = $1${targetType === "timeline" ? "" : " AND deleted_at IS NULL"}
      LIMIT 1`,
    [targetId],
  );
  return (res.rows[0]?.one ?? 0) === 1;
}

export async function assertTargetExists(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<boolean> {
  return targetExists(targetType, targetId);
}
