import { pool } from "../db.js";
import {
  normalizeWorldLayout,
  type WorldLayout,
} from "../config/world-layout.js";
import { sanitizePageCss } from "../config/page-css.js";

export const PAGE_KINDS = ["home", "collection", "custom"] as const;
export type PageKind = (typeof PAGE_KINDS)[number];

export type WorldPageRow = {
  id: string;
  world_id: string;
  kind: PageKind;
  collection_key: string | null;
  title: string;
  slug: string;
  sort_order: number;
  blocks: unknown;
  theme: unknown;
  css: string;
  status: "draft" | "published";
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type PublicWorldPage = {
  id: string;
  kind: PageKind;
  collectionKey: string | null;
  title: string;
  slug: string;
  sortOrder: number;
  layout: WorldLayout;
  css: string;
  status: "draft" | "published";
  updatedAt: string;
};

export function toPublicWorldPage(row: WorldPageRow): PublicWorldPage {
  return {
    id: row.id,
    kind: row.kind,
    collectionKey: row.collection_key,
    title: row.title ?? "",
    slug: row.slug ?? "",
    sortOrder: row.sort_order ?? 0,
    layout: normalizeWorldLayout({
      version: 2,
      blocks: row.blocks ?? [],
      theme: row.theme ?? {},
    }),
    css: row.css ?? "",
    status: row.status,
    updatedAt: row.updated_at.toISOString(),
  };
}

export async function listWorldPages(
  worldId: string,
  opts?: { includeDrafts?: boolean },
): Promise<WorldPageRow[]> {
  const includeDrafts = opts?.includeDrafts ?? false;
  const result = await pool.query<WorldPageRow>(
    `SELECT * FROM world_pages
      WHERE world_id = $1
        AND deleted_at IS NULL
        AND ($2::boolean OR status = 'published')
      ORDER BY (kind = 'home') DESC, sort_order, created_at`,
    [worldId, includeDrafts],
  );
  return result.rows;
}

export async function findWorldPage(
  worldId: string,
  pageId: string,
): Promise<WorldPageRow | null> {
  const result = await pool.query<WorldPageRow>(
    `SELECT * FROM world_pages
      WHERE id = $1 AND world_id = $2 AND deleted_at IS NULL
      LIMIT 1`,
    [pageId, worldId],
  );
  return result.rows[0] ?? null;
}

export async function findHomePage(
  worldId: string,
): Promise<WorldPageRow | null> {
  const result = await pool.query<WorldPageRow>(
    `SELECT * FROM world_pages
      WHERE world_id = $1 AND kind = 'home' AND deleted_at IS NULL
      LIMIT 1`,
    [worldId],
  );
  return result.rows[0] ?? null;
}

export async function createWorldPage(input: {
  worldId: string;
  kind: PageKind;
  collectionKey?: string | null;
  title?: string;
  slug?: string;
  layout?: WorldLayout;
  css?: string;
  status?: "draft" | "published";
  sortOrder?: number;
}): Promise<WorldPageRow> {
  const layout = input.layout ? normalizeWorldLayout(input.layout) : null;
  const result = await pool.query<WorldPageRow>(
    `INSERT INTO world_pages
       (world_id, kind, collection_key, title, slug, blocks, theme, css, status, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8, $9, $10)
     RETURNING *`,
    [
      input.worldId,
      input.kind,
      input.collectionKey ?? null,
      (input.title ?? "").slice(0, 120),
      (input.slug ?? "").slice(0, 80),
      JSON.stringify(layout?.blocks ?? []),
      JSON.stringify(layout?.theme ?? {}),
      sanitizePageCss(input.css),
      input.status ?? "published",
      input.sortOrder ?? 0,
    ],
  );
  return result.rows[0];
}

export async function updateWorldPage(
  pageId: string,
  worldId: string,
  patch: {
    title?: string;
    slug?: string;
    layout?: WorldLayout;
    css?: string;
    status?: "draft" | "published";
    sortOrder?: number;
  },
): Promise<WorldPageRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (patch.title !== undefined) {
    fields.push(`title = $${i++}`);
    values.push(patch.title.slice(0, 120));
  }
  if (patch.slug !== undefined) {
    fields.push(`slug = $${i++}`);
    values.push(patch.slug.slice(0, 80));
  }
  if (patch.css !== undefined) {
    fields.push(`css = $${i++}`);
    values.push(sanitizePageCss(patch.css));
  }
  if (patch.status !== undefined) {
    fields.push(`status = $${i++}`);
    values.push(patch.status);
  }
  if (patch.sortOrder !== undefined) {
    fields.push(`sort_order = $${i++}`);
    values.push(patch.sortOrder);
  }
  if (patch.layout !== undefined) {
    const layout = normalizeWorldLayout(patch.layout);
    fields.push(`blocks = $${i++}::jsonb`);
    values.push(JSON.stringify(layout.blocks));
    fields.push(`theme = $${i++}::jsonb`);
    values.push(JSON.stringify(layout.theme ?? {}));
  }

  if (fields.length === 0) return findWorldPage(worldId, pageId);

  fields.push(`updated_at = now()`);
  values.push(pageId, worldId);

  const result = await pool.query<WorldPageRow>(
    `UPDATE world_pages SET ${fields.join(", ")}
      WHERE id = $${i} AND world_id = $${i + 1} AND deleted_at IS NULL
      RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function softDeleteWorldPage(
  pageId: string,
  worldId: string,
): Promise<boolean> {
  const result = await pool.query(
    `UPDATE world_pages
        SET deleted_at = now(), updated_at = now()
      WHERE id = $1 AND world_id = $2 AND deleted_at IS NULL AND kind <> 'home'`,
    [pageId, worldId],
  );
  return (result.rowCount ?? 0) > 0;
}
