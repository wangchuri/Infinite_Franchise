import { pool } from "../db.js";

/**
 * Reaction 配置 v2：这里只定义「全局内置」反应（scope=global）。
 * 世界观自定义反应（scope=world）与「作品当表情」（kind=artwork）都由数据驱动，
 * 不走这个文件。新增内置类型只改 REACTION_TYPES 数组，syncReactionTypes()
 * 会在启动时把它们同步进 reaction_types 表。
 */
export type ReactionSeed = {
  key: string;
  label: string;
  icon: string;
  description: string;
  sortOrder: number;
};

export const REACTION_TYPES: ReactionSeed[] = [
  {
    key: "like",
    label: "点赞",
    icon: "👍",
    description: "喜欢这篇作品",
    sortOrder: 0,
  },
  {
    key: "awesome",
    label: "棒极了",
    icon: "🔥",
    description: "内容精彩，令人拍案叫绝",
    sortOrder: 1,
  },
  {
    key: "ooc_warn",
    label: "OOC 警告",
    icon: "⚠️",
    description: "人设或设定与世界观不符",
    sortOrder: 2,
  },
  {
    key: "heart",
    label: "感动",
    icon: "❤️",
    description: "触动人心，久久难忘",
    sortOrder: 3,
  },
  {
    key: "funny",
    label: "乐",
    icon: "😂",
    description: "太乐了，笑出声",
    sortOrder: 4,
  },
  {
    key: "rigorous",
    label: "设定严谨",
    icon: "🧠",
    description: "设定严谨，逻辑自洽",
    sortOrder: 5,
  },
  {
    key: "helpful",
    label: "有帮助",
    icon: "💡",
    description: "对创作很有参考价值",
    sortOrder: 6,
  },
];

/** Upsert global built-ins into DB (idempotent). Run at server boot. */
export async function syncReactionTypes(): Promise<void> {
  for (const r of REACTION_TYPES) {
    await pool.query(
      `INSERT INTO reaction_types (key, label, icon, description, sort_order, scope, kind, active)
       VALUES ($1, $2, $3, $4, $5, 'global', 'emoji', true)
       ON CONFLICT (key) WHERE scope = 'global'
       DO UPDATE SET label = EXCLUDED.label,
                     icon = EXCLUDED.icon,
                     description = EXCLUDED.description,
                     sort_order = EXCLUDED.sort_order,
                     active = true,
                     updated_at = now()`,
      [r.key, r.label, r.icon, r.description, r.sortOrder],
    );
  }
}

export type ReactionScope = "global" | "world";
export type ReactionKind = "emoji" | "artwork";

export type ReactionDef = {
  id: string;
  key: string;
  label: string;
  icon: string;
  description: string;
  sortOrder: number;
  scope: ReactionScope;
  kind: ReactionKind;
  worldId: string | null;
  artworkId: string | null;
  /** Thumbnail when kind = artwork (the sticker's artwork image). */
  artworkUrl: string | null;
};

type ReactionTypeRow = {
  id: string;
  key: string;
  label: string;
  icon: string;
  description: string;
  sort_order: number;
  scope: ReactionScope;
  kind: ReactionKind;
  world_id: string | null;
  artwork_id: string | null;
  artwork_url: string | null;
};

/**
 * Active reaction types available for a target in the given world:
 * every global built-in, plus that world's own custom reactions.
 * Pass null for world-agnostic contexts (e.g. the plaza) → globals only.
 */
export async function listReactionTypesForWorld(
  worldId: string | null,
): Promise<ReactionDef[]> {
  const res = await pool.query<ReactionTypeRow>(
    `SELECT rt.id, rt.key, rt.label, rt.icon, rt.description, rt.sort_order,
            rt.scope, rt.kind, rt.world_id, rt.artwork_id,
            aw.media_url AS artwork_url
       FROM reaction_types rt
       LEFT JOIN works aw ON aw.id = rt.artwork_id
      WHERE rt.active = true
        AND (
          rt.scope = 'global'
          OR (rt.scope = 'world' AND rt.world_id = $1)
        )
      ORDER BY rt.scope ASC, rt.sort_order ASC, rt.key ASC`,
    [worldId],
  );
  return res.rows.map((r) => ({
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
    artworkUrl: r.artwork_url,
  }));
}
