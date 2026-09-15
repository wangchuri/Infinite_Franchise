import { randomUUID } from "node:crypto";
import { pool } from "../db.js";
import { getMemberRole } from "./collab.js";
import { findAnyWorkById } from "./works.js";
import { findWorldById } from "./worlds.js";

/**
 * "Artwork as reaction": an artwork work can be promoted to a sticker that
 * anyone may use as a reaction. The sticker is a `reaction_types` row
 * (kind='artwork') scoped to the artwork's own world, so it is visible and
 * usable only there.
 */
export type StickerInfo = {
  id: string;
  label: string;
  artworkId: string;
  artworkUrl: string | null;
  usageCount: number;
};

type StickerRow = { id: string; label: string; artwork_id: string | null };

async function findStickerRow(workId: string): Promise<StickerRow | null> {
  const res = await pool.query<StickerRow>(
    `SELECT id, label, artwork_id
       FROM reaction_types
      WHERE kind = 'artwork' AND artwork_id = $1
      LIMIT 1`,
    [workId],
  );
  return res.rows[0] ?? null;
}

async function countUsage(typeId: string): Promise<number> {
  const res = await pool.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM reactions WHERE reaction_type_id = $1`,
    [typeId],
  );
  return res.rows[0]?.n ?? 0;
}

async function canManageSticker(
  workWorldId: string,
  workAuthorId: string,
  userId: string,
): Promise<boolean> {
  if (workAuthorId === userId) return true;
  const world = await findWorldById(workWorldId);
  if (world && world.creator_id === userId) return true;
  const role = await getMemberRole(workWorldId, userId);
  return role === "editor";
}

export async function getWorkSticker(
  workId: string,
  viewerId: string | null,
): Promise<{ sticker: StickerInfo | null; canManage: boolean }> {
  const work = await findAnyWorkById(workId);
  if (!work) return { sticker: null, canManage: false };

  const row = await findStickerRow(workId);
  const sticker: StickerInfo | null = row
    ? {
        id: row.id,
        label: row.label,
        artworkId: workId,
        artworkUrl: work.media_url ?? null,
        usageCount: await countUsage(row.id),
      }
    : null;

  const canManage = viewerId
    ? await canManageSticker(work.world_id, work.author_id, viewerId)
    : false;

  return { sticker, canManage };
}

export async function setWorkSticker(
  workId: string,
  userId: string,
): Promise<StickerInfo> {
  const work = await findAnyWorkById(workId);
  if (!work) {
    throw Object.assign(new Error("作品不存在"), { statusCode: 404 });
  }
  if (work.category !== "artwork") {
    throw Object.assign(new Error("只有美术作品可以设为表情"), {
      statusCode: 400,
    });
  }

  const existing = await findStickerRow(workId);
  if (existing) {
    return {
      id: existing.id,
      label: existing.label,
      artworkId: workId,
      artworkUrl: work.media_url ?? null,
      usageCount: await countUsage(existing.id),
    };
  }

  const key = `sticker_${randomUUID().replace(/-/g, "").slice(0, 12)}`;
  const label = work.title.slice(0, 32);
  const description = (work.summary ?? "").slice(0, 200);
  const res = await pool.query<StickerRow>(
    `INSERT INTO reaction_types
       (key, label, icon, description, sort_order, scope, kind, world_id,
        artwork_id, created_by, active)
     VALUES (
       $1, $2, '', $3,
       (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM reaction_types
         WHERE scope = 'world' AND world_id = $4),
       'world', 'artwork', $4, $5, $6, true
     )
     RETURNING id, label, artwork_id`,
    [key, label, description, work.world_id, workId, userId],
  );
  const row = res.rows[0];
  return {
    id: row.id,
    label: row.label,
    artworkId: workId,
    artworkUrl: work.media_url ?? null,
    usageCount: 0,
  };
}

export async function removeWorkSticker(
  workId: string,
  userId: string,
): Promise<boolean> {
  const work = await findAnyWorkById(workId);
  if (!work) {
    throw Object.assign(new Error("作品不存在"), { statusCode: 404 });
  }
  if (!(await canManageSticker(work.world_id, work.author_id, userId))) {
    throw Object.assign(new Error("无权取消该表情"), { statusCode: 403 });
  }
  const res = await pool.query(
    `DELETE FROM reaction_types WHERE kind = 'artwork' AND artwork_id = $1`,
    [workId],
  );
  return (res.rowCount ?? 0) > 0;
}
