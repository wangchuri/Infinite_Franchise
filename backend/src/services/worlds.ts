import type { PoolClient } from "pg";
import { pool } from "../db.js";
import {
  normalizeHomepageConfig,
  type HomepageConfig,
} from "../config/homepage-config.js";
import { normalizeWorldLayout, type WorldLayout } from "../config/world-layout.js";
import { withTransaction } from "./users.js";

export const TAG_PRESETS = [
  "科幻",
  "奇幻",
  "都市",
  "赛博",
  "历史",
  "悬疑",
  "冒险",
  "末日",
] as const;

/** 投稿协作模式：open=平台审核(直接发布)，review=创建者/编辑审核，invite_only=仅成员可写 */
export const WORK_SUBMIT_MODES = ["open", "review", "invite_only"] as const;
export type WorkSubmitMode = (typeof WORK_SUBMIT_MODES)[number];

export const MEMBER_ROLES = ["creator", "editor", "contributor", "viewer"] as const;
export type MemberRole = (typeof MEMBER_ROLES)[number];

export type WorldRow = {
  id: string;
  creator_id: string;
  parent_world_id: string | null;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  cover_url: string | null;
  logo_url: string | null;
  wiki_background_url: string | null;
  tags: string[];
  status: "draft" | "published";
  welcome_message: string | null;
  visibility: "public" | "private";
  allow_fork: boolean;
  homepage_config: Record<string, unknown>;
  world_layout: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
  /** Attached from world_permissions by attachWorkSubmitMode; not a DB column of worlds. */
  work_submit_mode?: WorkSubmitMode;
  /** Attached by the list queries for richer cards; not DB columns of worlds. */
  creator_name?: string | null;
  creator_username?: string | null;
  creator_avatar_url?: string | null;
  work_count?: number;
  entry_count?: number;
  follower_count?: number;
};

/**
 * Extra card columns: creator identity plus published work / entry / follower
 * counts. Requires the worlds table to be aliased as `w`.
 */
const WORLD_CARD_COLUMNS = `
  u.display_name AS creator_name,
  u.username     AS creator_username,
  u.avatar_url   AS creator_avatar_url,
  (SELECT count(*)::int FROM works wk
     WHERE wk.world_id = w.id AND wk.deleted_at IS NULL AND wk.status = 'published') AS work_count,
  (SELECT count(*)::int FROM wiki_entries we
     WHERE we.world_id = w.id AND we.status = 'published') AS entry_count,
  (SELECT count(*)::int FROM world_follows wf
     WHERE wf.world_id = w.id) AS follower_count`;

export type PublicWorld = {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  coverUrl: string | null;
  logoUrl: string | null;
  wikiBackgroundUrl: string | null;
  tags: string[];
  status: "draft" | "published";
  welcomeMessage: string | null;
  visibility: "public" | "private";
  allowFork: boolean;
  workSubmitMode: WorkSubmitMode;
  homepageConfig: HomepageConfig;
  layout: WorldLayout;
  createdAt: string;
  updatedAt: string;
  /** Present when the query attached card columns. */
  creatorName?: string | null;
  creatorUsername?: string | null;
  creatorAvatarUrl?: string | null;
  workCount?: number;
  entryCount?: number;
  followerCount?: number;
};

export function toPublicWorld(row: WorldRow): PublicWorld {
  return {
    id: row.id,
    creatorId: row.creator_id,
    name: row.name,
    slug: row.slug,
    tagline: row.tagline ?? "",
    description: row.description,
    coverUrl: row.cover_url,
    logoUrl: row.logo_url,
    wikiBackgroundUrl: row.wiki_background_url,
    tags: row.tags ?? [],
    status: row.status,
    welcomeMessage: row.welcome_message,
    visibility: row.visibility,
    allowFork: row.allow_fork,
    workSubmitMode: row.work_submit_mode ?? "review",
    homepageConfig: normalizeHomepageConfig(row.homepage_config),
    layout: normalizeWorldLayout(row.world_layout),
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    ...(row.creator_username !== undefined
      ? {
          creatorName: row.creator_name ?? null,
          creatorUsername: row.creator_username,
          creatorAvatarUrl: row.creator_avatar_url ?? null,
        }
      : {}),
    ...(row.work_count !== undefined
      ? {
          workCount: row.work_count,
          entryCount: row.entry_count ?? 0,
          followerCount: row.follower_count ?? 0,
        }
      : {}),
  };
}

/** Batch-attach each world's work_submit_mode from world_permissions. */
export async function attachWorkSubmitMode<T extends { id: string }>(
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  const res = await pool.query<{ world_id: string; work_submit_mode: string }>(
    `SELECT world_id, work_submit_mode FROM world_permissions
      WHERE world_id = ANY($1::uuid[])`,
    [ids],
  );
  const map = new Map<string, string>();
  for (const row of res.rows) map.set(row.world_id, row.work_submit_mode);
  for (const r of rows) {
    (r as T & { work_submit_mode?: WorkSubmitMode }).work_submit_mode =
      (map.get(r.id) as WorkSubmitMode) ?? "review";
  }
}

/** URL-safe ASCII slug. Chinese-only names fall back to "world". */
function slugify(name: string): string {
  const base = name
    .trim()
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^\x00-\x7F]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return base || "world";
}

async function uniqueSlug(
  client: PoolClient,
  name: string,
): Promise<string> {
  const base = slugify(name);
  // Always append a suffix so concurrent creates (e.g. React Strict Mode)
  // and identical Chinese names do not collide on the unique index.
  for (let i = 0; i < 30; i++) {
    const suffix = Math.random().toString(36).slice(2, 8);
    const candidate = `${base}-${suffix}`;
    const exists = await client.query(
      `SELECT 1 FROM worlds WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
      [candidate],
    );
    if (!exists.rowCount) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function createDraftWorld(input: {
  creatorId: string;
  name?: string;
}): Promise<WorldRow> {
  const name = (input.name?.trim() || "未命名世界观").slice(0, 80);

  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      return await withTransaction(async (client) => {
        const slug = await uniqueSlug(client, name);
        const worldRes = await client.query<WorldRow>(
          `INSERT INTO worlds (
             creator_id, name, slug, description, status, visibility
           ) VALUES ($1, $2, $3, '', 'draft', 'private')
           RETURNING *`,
          [input.creatorId, name, slug],
        );
        const world = worldRes.rows[0];

        await client.query(
          `INSERT INTO world_permissions (world_id) VALUES ($1)`,
          [world.id],
        );
        await client.query(
          `INSERT INTO world_members (world_id, user_id, role)
           VALUES ($1, $2, 'creator')`,
          [world.id, input.creatorId],
        );
        await client.query(
          `INSERT INTO world_follows (user_id, world_id)
           VALUES ($1, $2)
           ON CONFLICT DO NOTHING`,
          [input.creatorId, world.id],
        );
        await client.query(
          `INSERT INTO wiki_entries (
             world_id, category, title, slug, content, status, created_by, updated_by
           ) VALUES ($1, 'intro', '世界介绍', 'intro', '', 'published', $2, $2)`,
          [world.id, input.creatorId],
        );

        await attachWorkSubmitMode([world]);
        return world;
      });
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "23505" && attempt < 4) continue;
      throw err;
    }
  }

  throw new Error("failed to create world after retries");
}

export async function findWorldById(id: string): Promise<WorldRow | null> {
  const result = await pool.query<WorldRow>(
    `SELECT * FROM worlds WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  const row = result.rows[0] ?? null;
  if (row) await attachWorkSubmitMode([row]);
  return row;
}

export async function findWorldBySlug(slug: string): Promise<WorldRow | null> {
  const result = await pool.query<WorldRow>(
    `SELECT * FROM worlds WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
    [slug],
  );
  const row = result.rows[0] ?? null;
  if (row) await attachWorkSubmitMode([row]);
  return row;
}

export async function listMyWorlds(creatorId: string): Promise<WorldRow[]> {
  const result = await pool.query<WorldRow>(
    `SELECT w.*, ${WORLD_CARD_COLUMNS}
       FROM worlds w
       LEFT JOIN users u ON u.id = w.creator_id
      WHERE w.creator_id = $1 AND w.deleted_at IS NULL
      ORDER BY w.updated_at DESC`,
    [creatorId],
  );
  await attachWorkSubmitMode(result.rows);
  return result.rows;
}

/** Published + public worlds for the plaza / discovery feed. */
export async function listPublicWorlds(limit = 48): Promise<WorldRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 100);
  const result = await pool.query<WorldRow>(
    `SELECT w.*, ${WORLD_CARD_COLUMNS}
       FROM worlds w
       LEFT JOIN users u ON u.id = w.creator_id
      WHERE w.status = 'published'
        AND w.visibility = 'public'
        AND w.deleted_at IS NULL
      ORDER BY w.updated_at DESC
      LIMIT $1`,
    [safeLimit],
  );
  await attachWorkSubmitMode(result.rows);
  return result.rows;
}

/** Worlds the user follows (plaza left rail). */
export async function listFollowedWorlds(
  userId: string,
  limit = 24,
): Promise<WorldRow[]> {
  const safeLimit = Math.min(Math.max(limit, 1), 50);
  const result = await pool.query<WorldRow>(
    `SELECT w.*, ${WORLD_CARD_COLUMNS}
       FROM world_follows wf0
       JOIN worlds w ON w.id = wf0.world_id
       LEFT JOIN users u ON u.id = w.creator_id
      WHERE wf0.user_id = $1
        AND w.deleted_at IS NULL
      ORDER BY wf0.created_at DESC
      LIMIT $2`,
    [userId, safeLimit],
  );
  await attachWorkSubmitMode(result.rows);
  return result.rows;
}

export async function updateWorld(
  id: string,
  patch: {
    name?: string;
    tagline?: string;
    description?: string;
    logoUrl?: string | null;
    wikiBackgroundUrl?: string | null;
    coverUrl?: string | null;
    tags?: string[];
    welcomeMessage?: string | null;
    homepageConfig?: HomepageConfig;
    layout?: WorldLayout;
    workSubmitMode?: WorkSubmitMode;
  },
): Promise<WorldRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  const map: Array<[keyof typeof patch, string]> = [
    ["name", "name"],
    ["tagline", "tagline"],
    ["description", "description"],
    ["logoUrl", "logo_url"],
    ["wikiBackgroundUrl", "wiki_background_url"],
    ["coverUrl", "cover_url"],
    ["tags", "tags"],
    ["welcomeMessage", "welcome_message"],
  ];

  for (const [key, col] of map) {
    if (patch[key] !== undefined) {
      fields.push(`${col} = $${i++}`);
      values.push(patch[key]);
    }
  }

  if (patch.homepageConfig !== undefined) {
    fields.push(`homepage_config = $${i++}::jsonb`);
    values.push(JSON.stringify(normalizeHomepageConfig(patch.homepageConfig)));
  }

  if (patch.layout !== undefined) {
    fields.push(`world_layout = $${i++}::jsonb`);
    values.push(JSON.stringify(normalizeWorldLayout(patch.layout)));
  }

  if (patch.workSubmitMode !== undefined) {
    await pool.query(
      `INSERT INTO world_permissions (world_id, work_submit_mode)
       VALUES ($1, $2)
       ON CONFLICT (world_id)
       DO UPDATE SET work_submit_mode = EXCLUDED.work_submit_mode,
                     updated_at = now()`,
      [id, patch.workSubmitMode],
    );
  }

  if (fields.length === 0) {
    return findWorldById(id);
  }

  fields.push(`updated_at = now()`);
  values.push(id);

  const result = await pool.query<WorldRow>(
    `UPDATE worlds SET ${fields.join(", ")}
     WHERE id = $${i} AND deleted_at IS NULL
     RETURNING *`,
    values,
  );
  if (result.rows[0]) await attachWorkSubmitMode(result.rows);
  return result.rows[0] ?? null;
}

export async function publishWorld(id: string): Promise<WorldRow | null> {
  const result = await pool.query<WorldRow>(
    `UPDATE worlds
     SET status = 'published', visibility = 'public', updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL
     RETURNING *`,
    [id],
  );
  if (result.rows[0]) await attachWorkSubmitMode(result.rows);
  return result.rows[0] ?? null;
}

export async function softDeleteWorld(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE worlds
     SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export function canViewWorld(
  world: WorldRow,
  viewerId: string | null,
): boolean {
  if (world.deleted_at) return false;
  if (world.status === "published" && world.visibility === "public") {
    return true;
  }
  return viewerId != null && world.creator_id === viewerId;
}

export function isWorldCreator(world: WorldRow, userId: string): boolean {
  return world.creator_id === userId;
}
