/**
 * Per-category extra attributes for wiki entries.
 * Mirrors backend/src/config/entry-schema.ts — keep the two files in sync.
 */
import type { WorldCollection } from "./collections";

export type EntryAttributeField = {
  key: string;
  label: string;
};

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

/**
 * Attribute fields for a collection key. An author-defined collection's own
 * `attrFields` win; otherwise fall back to the built-in schema for that key.
 */
export function entryAttributeFields(
  category: string,
  collections?: WorldCollection[],
): EntryAttributeField[] {
  const col = collections?.find((c) => c.key === category);
  if (col && col.attrFields.length > 0) return col.attrFields;
  return ENTRY_ATTRIBUTE_SCHEMA[category] ?? [];
}
