import { pool } from "../db.js";
import {
  BUILTIN_COLLECTIONS,
  RESERVED_CATEGORY_KEYS,
  sanitizeAttrFields,
  sanitizeCollectionKey,
  type CollectionAttrField,
} from "../config/collections.js";

export type WorldCollectionRow = {
  id: string;
  world_id: string;
  key: string;
  name: string;
  icon_url: string | null;
  color: string | null;
  attr_fields: CollectionAttrField[];
  sort_order: number;
  hidden: boolean;
  is_builtin: boolean;
  created_at: Date;
  updated_at: Date;
};

export type PublicCollection = {
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

export function toPublicCollection(row: WorldCollectionRow): PublicCollection {
  return {
    id: row.id,
    key: row.key,
    name: row.name,
    iconUrl: row.icon_url,
    color: row.color,
    attrFields: sanitizeAttrFields(row.attr_fields),
    sortOrder: row.sort_order,
    hidden: row.hidden,
    isBuiltin: row.is_builtin,
  };
}

/** Idempotently insert the built-in collections for a world. */
export async function ensureDefaultCollections(worldId: string): Promise<void> {
  const values: string[] = [];
  const params: unknown[] = [worldId];
  let i = 2;
  for (const c of BUILTIN_COLLECTIONS) {
    values.push(`($1, $${i++}, $${i++}, $${i++}, true)`);
    params.push(c.key, c.name, c.sortOrder);
  }
  await pool.query(
    `INSERT INTO world_collections (world_id, key, name, sort_order, is_builtin)
     VALUES ${values.join(", ")}
     ON CONFLICT (world_id, key) DO NOTHING`,
    params,
  );
}

export async function listCollections(
  worldId: string,
  opts: { includeHidden?: boolean } = {},
): Promise<WorldCollectionRow[]> {
  await ensureDefaultCollections(worldId);
  const hiddenClause = opts.includeHidden ? "" : "AND hidden = false";
  const result = await pool.query<WorldCollectionRow>(
    `SELECT * FROM world_collections
     WHERE world_id = $1 ${hiddenClause}
     ORDER BY sort_order ASC, name ASC`,
    [worldId],
  );
  return result.rows;
}

export async function findCollectionByKey(
  worldId: string,
  key: string,
): Promise<WorldCollectionRow | null> {
  const result = await pool.query<WorldCollectionRow>(
    `SELECT * FROM world_collections WHERE world_id = $1 AND key = $2 LIMIT 1`,
    [worldId, key],
  );
  return result.rows[0] ?? null;
}

export async function collectionKeys(worldId: string): Promise<Set<string>> {
  const rows = await listCollections(worldId, { includeHidden: true });
  return new Set(rows.map((r) => r.key));
}

/** Category values accepted when writing entries. */
export async function isValidCategory(
  worldId: string,
  category: string,
): Promise<boolean> {
  if (!category || RESERVED_CATEGORY_KEYS.has(category)) return false;
  return (await collectionKeys(worldId)).has(category);
}

async function uniqueCollectionKey(
  worldId: string,
  preferred: string,
): Promise<string> {
  const base = sanitizeCollectionKey(preferred) || "collection";
  for (let n = 0; n < 30; n++) {
    const candidate = n === 0 ? base : `${base}-${n + 1}`;
    const exists = await pool.query(
      `SELECT 1 FROM world_collections WHERE world_id = $1 AND key = $2 LIMIT 1`,
      [worldId, candidate],
    );
    if (!exists.rowCount) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createCollection(input: {
  worldId: string;
  name: string;
  key?: string;
  iconUrl?: string | null;
  color?: string | null;
  attrFields?: CollectionAttrField[];
}): Promise<WorldCollectionRow> {
  await ensureDefaultCollections(input.worldId);
  const key = await uniqueCollectionKey(
    input.worldId,
    input.key || input.name,
  );
  const max = await pool.query<{ m: number | null }>(
    `SELECT MAX(sort_order) AS m FROM world_collections WHERE world_id = $1`,
    [input.worldId],
  );
  const sortOrder = (max.rows[0]?.m ?? -1) + 1;
  const result = await pool.query<WorldCollectionRow>(
    `INSERT INTO world_collections
       (world_id, key, name, icon_url, color, attr_fields, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7)
     RETURNING *`,
    [
      input.worldId,
      key,
      input.name.slice(0, 60),
      input.iconUrl ?? null,
      input.color ?? null,
      JSON.stringify(sanitizeAttrFields(input.attrFields)),
      sortOrder,
    ],
  );
  return result.rows[0];
}

export async function updateCollection(
  id: string,
  worldId: string,
  patch: {
    name?: string;
    iconUrl?: string | null;
    color?: string | null;
    attrFields?: CollectionAttrField[];
    sortOrder?: number;
    hidden?: boolean;
  },
): Promise<WorldCollectionRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (patch.name !== undefined) {
    fields.push(`name = $${i++}`);
    values.push(patch.name.slice(0, 60));
  }
  if (patch.iconUrl !== undefined) {
    fields.push(`icon_url = $${i++}`);
    values.push(patch.iconUrl);
  }
  if (patch.color !== undefined) {
    fields.push(`color = $${i++}`);
    values.push(patch.color);
  }
  if (patch.attrFields !== undefined) {
    fields.push(`attr_fields = $${i++}::jsonb`);
    values.push(JSON.stringify(sanitizeAttrFields(patch.attrFields)));
  }
  if (patch.sortOrder !== undefined) {
    fields.push(`sort_order = $${i++}`);
    values.push(patch.sortOrder);
  }
  if (patch.hidden !== undefined) {
    fields.push(`hidden = $${i++}`);
    values.push(patch.hidden);
  }

  if (fields.length === 0) {
    const cur = await pool.query<WorldCollectionRow>(
      `SELECT * FROM world_collections WHERE id = $1 AND world_id = $2 LIMIT 1`,
      [id, worldId],
    );
    return cur.rows[0] ?? null;
  }

  fields.push(`updated_at = now()`);
  values.push(id, worldId);

  const result = await pool.query<WorldCollectionRow>(
    `UPDATE world_collections SET ${fields.join(", ")}
     WHERE id = $${i++} AND world_id = $${i}
     RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export type DeleteCollectionResult =
  | { ok: true }
  | { ok: false; reason: "not_found" | "builtin" | "has_entries" };

export async function deleteCollection(
  id: string,
  worldId: string,
): Promise<DeleteCollectionResult> {
  const cur = await pool.query<WorldCollectionRow>(
    `SELECT * FROM world_collections WHERE id = $1 AND world_id = $2 LIMIT 1`,
    [id, worldId],
  );
  const row = cur.rows[0];
  if (!row) return { ok: false, reason: "not_found" };
  if (row.is_builtin) return { ok: false, reason: "builtin" };

  const used = await pool.query(
    `SELECT 1 FROM wiki_entries
     WHERE world_id = $1 AND category = $2 AND deleted_at IS NULL LIMIT 1`,
    [worldId, row.key],
  );
  if (used.rowCount) return { ok: false, reason: "has_entries" };

  await pool.query(`DELETE FROM world_collections WHERE id = $1`, [id]);
  return { ok: true };
}
