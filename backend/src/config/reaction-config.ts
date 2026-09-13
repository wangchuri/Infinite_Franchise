import { pool } from "../db.js";

/**
 * Reaction 配置：这里是「棒极了 / OOC 警告」等反应类型的唯一来源。
 * 新增/修改类型只需改这个数组，然后 syncReactionTypes() 会把它们同步到
 * reaction_types 表，前端从 GET /api/reactions/types 动态读取。
 */
export type ReactionDef = {
  key: string;
  label: string;
  icon: string;
  description: string;
  sortOrder: number;
};

export const REACTION_TYPES: ReactionDef[] = [
  {
    key: "awesome",
    label: "棒极了",
    icon: "👍",
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

const REACTION_KEYS = new Set(REACTION_TYPES.map((r) => r.key));

export function isKnownReactionType(key: string): boolean {
  return REACTION_KEYS.has(key);
}

/** Upsert configured types into DB (idempotent). Run at server boot. */
export async function syncReactionTypes(): Promise<void> {
  for (const r of REACTION_TYPES) {
    await pool.query(
      `INSERT INTO reaction_types (key, label, icon, description, sort_order, active)
       VALUES ($1, $2, $3, $4, $5, true)
       ON CONFLICT (key)
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

export type ReactionTypeRow = {
  key: string;
  label: string;
  icon: string;
  description: string;
  sort_order: number;
  active: boolean;
};

export async function listActiveReactionTypes(): Promise<ReactionDef[]> {
  const res = await pool.query<ReactionTypeRow>(
    `SELECT key, label, icon, description, sort_order, active
       FROM reaction_types
      WHERE active = true
      ORDER BY sort_order ASC, key ASC`,
  );
  return res.rows.map((r) => ({
    key: r.key,
    label: r.label,
    icon: r.icon,
    description: r.description,
    sortOrder: r.sort_order,
  }));
}
