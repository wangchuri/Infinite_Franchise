/**
 * Author-defined collections (归属) that replace the old fixed entry category
 * enum. Mirrors frontend/src/lib/collections.ts — keep the two files in sync.
 */
import type { EntryAttributeField } from "./entry-schema.js";

export type CollectionAttrField = EntryAttributeField;

/** Keys seeded for every world; may be renamed/hidden but never deleted. */
export const BUILTIN_COLLECTIONS = [
  { key: "character", name: "人物", sortOrder: 0 },
  { key: "location", name: "地点", sortOrder: 1 },
  { key: "item", name: "物品", sortOrder: 2 },
  { key: "organization", name: "组织", sortOrder: 3 },
  { key: "event", name: "事件", sortOrder: 4 },
  { key: "concept", name: "概念", sortOrder: 5 },
  { key: "other", name: "其他", sortOrder: 6 },
] as const;

/** `intro` is the reserved world-intro entry, not a collection. */
export const RESERVED_CATEGORY_KEYS = new Set(["intro"]);

/** Normalize a title into a stable, url-safe collection key. */
export function collectionKeyFrom(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export function sanitizeCollectionKey(raw: string): string {
  return raw
    .trim()
    .replace(/[^\p{L}\p{N}_-]/gu, "")
    .slice(0, 40);
}

export function sanitizeAttrFields(raw: unknown): CollectionAttrField[] {
  if (!Array.isArray(raw)) return [];
  const out: CollectionAttrField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const src = item as Record<string, unknown>;
    const key =
      typeof src.key === "string" ? src.key.replace(/[^\w-]/g, "").slice(0, 40) : "";
    if (!key || out.some((f) => f.key === key)) continue;
    const label =
      typeof src.label === "string" && src.label.trim()
        ? src.label.slice(0, 40)
        : key;
    out.push({ key, label });
    if (out.length >= 20) break;
  }
  return out;
}
