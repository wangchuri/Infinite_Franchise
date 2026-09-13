/**
 * Work taxonomy: broad category (right rail) + subtype/kind (top tabs).
 *
 * Stable English keys are stored; Chinese labels live here only.
 * Mirrors frontend/src/lib/work-taxonomy.ts — keep the two files in sync.
 */

export const WORK_CATEGORIES = [
  { key: "novel", label: "小说" },
  { key: "artwork", label: "美术" },
  { key: "program", label: "程序" },
  { key: "audio", label: "音频" },
  { key: "video", label: "视频" },
  { key: "other", label: "其他" },
] as const;

export type WorkCategory = (typeof WORK_CATEGORIES)[number]["key"];

export type WorkKind = { key: string; label: string };

export const WORK_KINDS: Record<WorkCategory, WorkKind[]> = {
  novel: [
    { key: "short", label: "短篇" },
    { key: "long", label: "长篇" },
    { key: "chapter", label: "章节" },
  ],
  artwork: [
    { key: "illustration", label: "插画" },
    { key: "comic", label: "漫画" },
    { key: "design", label: "设定" },
    { key: "cover", label: "封面" },
  ],
  program: [
    { key: "tool", label: "工具" },
    { key: "interactive", label: "互动" },
    { key: "gameplay", label: "玩法" },
  ],
  audio: [
    { key: "music", label: "音乐" },
    { key: "dubbing", label: "配音" },
    { key: "sfx", label: "音效" },
  ],
  video: [
    { key: "clip", label: "剪辑" },
    { key: "animation", label: "动画" },
    { key: "live", label: "实录" },
  ],
  other: [],
};

const CATEGORY_SET = new Set<string>(WORK_CATEGORIES.map((c) => c.key));

export function isWorkCategory(value: unknown): value is WorkCategory {
  return typeof value === "string" && CATEGORY_SET.has(value);
}

export function isWorkKind(category: WorkCategory, kind: unknown): boolean {
  if (kind === "" || kind == null) return true;
  if (typeof kind !== "string") return false;
  return WORK_KINDS[category].some((k) => k.key === kind);
}

export function categoryLabel(category: string): string {
  return WORK_CATEGORIES.find((c) => c.key === category)?.label ?? category;
}

export function kindLabel(category: string, kind: string): string {
  if (!kind) return "";
  const list = WORK_KINDS[category as WorkCategory] ?? [];
  return list.find((k) => k.key === kind)?.label ?? kind;
}

/** Structural type stored in works.type (reader still uses novel/chapter). */
export function structuralType(
  category: WorkCategory,
  kind: string,
): "novel" | "chapter" | "story" | "artwork" | "program" | "audio" | "video" | "other" {
  if (category === "novel") {
    if (kind === "long") return "novel";
    if (kind === "chapter") return "chapter";
    return "story";
  }
  return category;
}
