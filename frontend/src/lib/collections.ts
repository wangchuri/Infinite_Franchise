/**
 * Author-defined collections (归属). Mirrors
 * backend/src/config/collections.ts + backend/src/services/collections.ts.
 */
import { apiFetch } from "./api";

export type CollectionAttrField = {
  key: string;
  label: string;
};

export type WorldCollection = {
  id: string;
  key: string;
  name: string;
  iconUrl: string | null;
  color: string | null;
  attrFields: CollectionAttrField[];
  sortOrder: number;
  hidden: boolean;
  isBuiltin: boolean;
};

/** Keys seeded for every world; may be renamed/hidden but never deleted. */
export const BUILTIN_COLLECTIONS = [
  { key: "character", name: "人物" },
  { key: "location", name: "地点" },
  { key: "item", name: "物品" },
  { key: "organization", name: "组织" },
  { key: "event", name: "事件" },
  { key: "concept", name: "概念" },
  { key: "other", name: "其他" },
] as const;

const BUILTIN_NAME: Record<string, string> = Object.fromEntries(
  BUILTIN_COLLECTIONS.map((c) => [c.key, c.name]),
);

export function collectionName(
  collections: WorldCollection[] | undefined,
  key: string,
): string {
  return (
    collections?.find((c) => c.key === key)?.name ??
    BUILTIN_NAME[key] ??
    key
  );
}

export function normalizeAttrFields(raw: unknown): CollectionAttrField[] {
  if (!Array.isArray(raw)) return [];
  const out: CollectionAttrField[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object" || Array.isArray(item)) continue;
    const src = item as Record<string, unknown>;
    const key = typeof src.key === "string" ? src.key.slice(0, 40) : "";
    if (!key) continue;
    const label =
      typeof src.label === "string" && src.label.trim()
        ? src.label.slice(0, 40)
        : key;
    out.push({ key, label });
  }
  return out;
}

export function normalizeCollection(raw: unknown): WorldCollection | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  const key = typeof src.key === "string" ? src.key : "";
  if (!key) return null;
  return {
    id: typeof src.id === "string" ? src.id : key,
    key,
    name:
      typeof src.name === "string" && src.name.trim()
        ? src.name
        : (BUILTIN_NAME[key] ?? key),
    iconUrl: typeof src.iconUrl === "string" ? src.iconUrl : null,
    color: typeof src.color === "string" ? src.color : null,
    attrFields: normalizeAttrFields(src.attrFields),
    sortOrder: typeof src.sortOrder === "number" ? src.sortOrder : 0,
    hidden: src.hidden === true,
    isBuiltin: src.isBuiltin === true,
  };
}

export function normalizeCollections(raw: unknown): WorldCollection[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map(normalizeCollection)
    .filter((c): c is WorldCollection => c !== null)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export async function fetchCollections(
  worldId: string,
): Promise<WorldCollection[]> {
  const data = await apiFetch<{ collections: WorldCollection[] }>(
    `/api/worlds/${worldId}/collections`,
  );
  return normalizeCollections(data.collections);
}

export async function createCollection(
  worldId: string,
  input: { name: string; iconUrl?: string | null; color?: string | null },
): Promise<WorldCollection> {
  const data = await apiFetch<{ collection: WorldCollection }>(
    `/api/worlds/${worldId}/collections`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return normalizeCollection(data.collection)!;
}

export async function updateCollection(
  worldId: string,
  collectionId: string,
  patch: Partial<{
    name: string;
    iconUrl: string | null;
    color: string | null;
    attrFields: CollectionAttrField[];
    sortOrder: number;
    hidden: boolean;
  }>,
): Promise<WorldCollection> {
  const data = await apiFetch<{ collection: WorldCollection }>(
    `/api/worlds/${worldId}/collections/${collectionId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return normalizeCollection(data.collection)!;
}

export async function deleteCollection(
  worldId: string,
  collectionId: string,
): Promise<void> {
  await apiFetch(`/api/worlds/${worldId}/collections/${collectionId}`, {
    method: "DELETE",
  });
}
