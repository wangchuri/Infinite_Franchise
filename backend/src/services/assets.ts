import { pool } from "../db.js";

export type WorldAssetRow = {
  id: string;
  world_id: string;
  url: string;
  kind: string;
  filename: string;
  size: number | null;
  width: number | null;
  height: number | null;
  uploaded_by: string | null;
  created_at: Date;
};

export type PublicWorldAsset = {
  id: string;
  url: string;
  kind: string;
  filename: string;
  size: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export function toPublicAsset(row: WorldAssetRow): PublicWorldAsset {
  return {
    id: row.id,
    url: row.url,
    kind: row.kind ?? "image",
    filename: row.filename ?? "",
    size: row.size ?? null,
    width: row.width ?? null,
    height: row.height ?? null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function listWorldAssets(
  worldId: string,
  limit = 200,
): Promise<WorldAssetRow[]> {
  const result = await pool.query<WorldAssetRow>(
    `SELECT * FROM world_assets
      WHERE world_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [worldId, Math.min(Math.max(limit, 1), 500)],
  );
  return result.rows;
}

/** Idempotent on (world_id, url): re-adding a URL returns the existing row. */
export async function createWorldAsset(input: {
  worldId: string;
  url: string;
  kind?: string;
  filename?: string;
  size?: number | null;
  width?: number | null;
  height?: number | null;
  uploadedBy: string | null;
}): Promise<WorldAssetRow> {
  const result = await pool.query<WorldAssetRow>(
    `INSERT INTO world_assets
       (world_id, url, kind, filename, size, width, height, uploaded_by)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     ON CONFLICT (world_id, url) DO UPDATE
       SET filename = EXCLUDED.filename
     RETURNING *`,
    [
      input.worldId,
      input.url.slice(0, 2000),
      (input.kind ?? "image").slice(0, 16),
      (input.filename ?? "").slice(0, 200),
      input.size ?? null,
      input.width ?? null,
      input.height ?? null,
      input.uploadedBy,
    ],
  );
  return result.rows[0];
}

export async function deleteWorldAsset(
  assetId: string,
  worldId: string,
): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM world_assets WHERE id = $1 AND world_id = $2`,
    [assetId, worldId],
  );
  return (result.rowCount ?? 0) > 0;
}
