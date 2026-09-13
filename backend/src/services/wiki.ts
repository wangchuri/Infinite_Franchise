import { pool } from "../db.js";

export type WikiEntryRow = {
  id: string;
  world_id: string;
  category: string;
  title: string;
  slug: string;
  aliases: string[];
  content: string;
  image_url: string | null;
  status: string;
  created_by: string;
  updated_by: string;
  version: number;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type PublicWikiEntry = {
  id: string;
  worldId: string;
  category: string;
  title: string;
  slug: string;
  aliases: string[];
  content: string;
  imageUrl: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

export type TimelineEventRow = {
  id: string;
  world_id: string;
  title: string;
  description: string;
  event_date: string;
  sort_order: number;
  created_by: string | null;
  created_at: Date;
  updated_at: Date;
};

export type PublicTimelineEvent = {
  id: string;
  worldId: string;
  title: string;
  description: string;
  eventDate: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export function toPublicEntry(row: WikiEntryRow): PublicWikiEntry {
  return {
    id: row.id,
    worldId: row.world_id,
    category: row.category,
    title: row.title,
    slug: row.slug,
    aliases: row.aliases ?? [],
    content: row.content,
    imageUrl: row.image_url,
    status: row.status,
    version: row.version,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

export function toPublicTimeline(row: TimelineEventRow): PublicTimelineEvent {
  return {
    id: row.id,
    worldId: row.world_id,
    title: row.title,
    description: row.description,
    eventDate: row.event_date,
    sortOrder: row.sort_order,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
  };
}

function entrySlugify(title: string): string {
  const base = title
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return base || "entry";
}

async function uniqueEntrySlug(
  worldId: string,
  title: string,
): Promise<string> {
  const base = entrySlugify(title);
  for (let i = 0; i < 20; i++) {
    const candidate =
      i === 0 ? base : `${base}-${Math.random().toString(36).slice(2, 6)}`;
    const exists = await pool.query(
      `SELECT 1 FROM wiki_entries
       WHERE world_id = $1 AND slug = $2 AND deleted_at IS NULL LIMIT 1`,
      [worldId, candidate],
    );
    if (!exists.rowCount) return candidate;
  }
  return `${base}-${Date.now().toString(36)}`;
}

export async function listEntries(
  worldId: string,
  category?: string,
): Promise<WikiEntryRow[]> {
  if (category) {
    const result = await pool.query<WikiEntryRow>(
      `SELECT * FROM wiki_entries
       WHERE world_id = $1 AND category = $2 AND deleted_at IS NULL
       ORDER BY title`,
      [worldId, category],
    );
    return result.rows;
  }
  const result = await pool.query<WikiEntryRow>(
    `SELECT * FROM wiki_entries
     WHERE world_id = $1 AND deleted_at IS NULL
     ORDER BY category, title`,
    [worldId],
  );
  return result.rows;
}

export async function findEntryById(
  id: string,
): Promise<WikiEntryRow | null> {
  const result = await pool.query<WikiEntryRow>(
    `SELECT * FROM wiki_entries WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createEntry(input: {
  worldId: string;
  category: string;
  title: string;
  content?: string;
  imageUrl?: string | null;
  userId: string;
}): Promise<WikiEntryRow> {
  const slug = await uniqueEntrySlug(input.worldId, input.title);
  const result = await pool.query<WikiEntryRow>(
    `INSERT INTO wiki_entries (
       world_id, category, title, slug, content, image_url,
       status, created_by, updated_by
     ) VALUES ($1, $2, $3, $4, $5, $6, 'published', $7, $7)
     RETURNING *`,
    [
      input.worldId,
      input.category,
      input.title.slice(0, 120),
      slug,
      input.content ?? "",
      input.imageUrl ?? null,
      input.userId,
    ],
  );
  return result.rows[0];
}

export async function updateEntry(
  id: string,
  userId: string,
  patch: {
    title?: string;
    content?: string;
    imageUrl?: string | null;
  },
): Promise<WikiEntryRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (patch.title !== undefined) {
    fields.push(`title = $${i++}`);
    values.push(patch.title.slice(0, 120));
  }
  if (patch.content !== undefined) {
    fields.push(`content = $${i++}`);
    values.push(patch.content);
  }
  if (patch.imageUrl !== undefined) {
    fields.push(`image_url = $${i++}`);
    values.push(patch.imageUrl);
  }

  if (fields.length === 0) return findEntryById(id);

  fields.push(`updated_by = $${i++}`);
  values.push(userId);
  fields.push(`version = version + 1`);
  fields.push(`updated_at = now()`);
  values.push(id);

  const result = await pool.query<WikiEntryRow>(
    `UPDATE wiki_entries SET ${fields.join(", ")}
     WHERE id = $${i} AND deleted_at IS NULL
     RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function softDeleteEntry(id: string): Promise<boolean> {
  const result = await pool.query(
    `UPDATE wiki_entries SET deleted_at = now(), updated_at = now()
     WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}

export async function listTimeline(
  worldId: string,
): Promise<TimelineEventRow[]> {
  const result = await pool.query<TimelineEventRow>(
    `SELECT * FROM timeline_events
     WHERE world_id = $1
     ORDER BY sort_order ASC, created_at ASC`,
    [worldId],
  );
  return result.rows;
}

export async function findTimelineEvent(
  id: string,
): Promise<TimelineEventRow | null> {
  const result = await pool.query<TimelineEventRow>(
    `SELECT * FROM timeline_events WHERE id = $1 LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function createTimelineEvent(input: {
  worldId: string;
  title: string;
  description?: string;
  eventDate?: string;
  userId: string;
}): Promise<TimelineEventRow> {
  const max = await pool.query<{ m: number | null }>(
    `SELECT MAX(sort_order) AS m FROM timeline_events WHERE world_id = $1`,
    [input.worldId],
  );
  const sortOrder = (max.rows[0]?.m ?? -1) + 1;

  const result = await pool.query<TimelineEventRow>(
    `INSERT INTO timeline_events (
       world_id, title, description, event_date, sort_order, created_by
     ) VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [
      input.worldId,
      input.title.slice(0, 200),
      input.description ?? "",
      input.eventDate ?? "",
      sortOrder,
      input.userId,
    ],
  );
  return result.rows[0];
}

export async function updateTimelineEvent(
  id: string,
  patch: {
    title?: string;
    description?: string;
    eventDate?: string;
    sortOrder?: number;
  },
): Promise<TimelineEventRow | null> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;

  if (patch.title !== undefined) {
    fields.push(`title = $${i++}`);
    values.push(patch.title.slice(0, 200));
  }
  if (patch.description !== undefined) {
    fields.push(`description = $${i++}`);
    values.push(patch.description);
  }
  if (patch.eventDate !== undefined) {
    fields.push(`event_date = $${i++}`);
    values.push(patch.eventDate);
  }
  if (patch.sortOrder !== undefined) {
    fields.push(`sort_order = $${i++}`);
    values.push(patch.sortOrder);
  }

  if (fields.length === 0) return findTimelineEvent(id);

  fields.push(`updated_at = now()`);
  values.push(id);

  const result = await pool.query<TimelineEventRow>(
    `UPDATE timeline_events SET ${fields.join(", ")}
     WHERE id = $${i}
     RETURNING *`,
    values,
  );
  return result.rows[0] ?? null;
}

export async function deleteTimelineEvent(id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM timeline_events WHERE id = $1`,
    [id],
  );
  return (result.rowCount ?? 0) > 0;
}
