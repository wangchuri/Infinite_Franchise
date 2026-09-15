/**
 * Per-category extra attributes for wiki entries. Mirrors
 * frontend/src/lib/entry-schema.ts — keep the two files in sync.
 *
 * Values are stored as a flat string map on wiki_entries.attributes and are
 * matched by region card variants (e.g. role == "NPC").
 */
export type EntryAttributeField = {
  key: string;
  label: string;
};

export const ENTRY_CATEGORIES = [
  "character",
  "location",
  "item",
  "organization",
  "event",
  "concept",
  "other",
] as const;

export const ENTRY_ATTRIBUTE_SCHEMA: Record<string, EntryAttributeField[]> = {
  character: [
    { key: "role", label: "身份" },
    { key: "age", label: "年龄" },
    { key: "affiliation", label: "所属" },
    { key: "appearance", label: "外貌" },
  ],
  location: [
    { key: "type", label: "类型" },
    { key: "region", label: "所属区域" },
    { key: "terrain", label: "地貌" },
  ],
  organization: [
    { key: "type", label: "类型" },
    { key: "leader", label: "领袖" },
    { key: "purpose", label: "宗旨" },
  ],
  event: [
    { key: "date", label: "时间" },
    { key: "place", label: "地点" },
    { key: "outcome", label: "结果" },
  ],
  item: [
    { key: "type", label: "类型" },
    { key: "owner", label: "持有者" },
  ],
  concept: [],
  other: [],
};

export function entryAttributeFields(category: string): EntryAttributeField[] {
  return ENTRY_ATTRIBUTE_SCHEMA[category] ?? [];
}

/** Keep only string values with safe keys, bounded in size. */
export function sanitizeAttributes(
  raw: unknown,
): Record<string, string> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, string> = {};
  let n = 0;
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= 40) break;
    if (typeof v !== "string") continue;
    const key = k.replace(/[^\w-]/g, "").slice(0, 40);
    if (!key) continue;
    out[key] = v.slice(0, 500);
    n += 1;
  }
  return out;
}
