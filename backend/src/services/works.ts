import { pool } from "../db.js";
import {
  isWorkCategory,
  isWorkKind,
  structuralType,
  type WorkCategory,
} from "../config/work-taxonomy.js";
import { canCreateWorks, getMemberRole, getWorkSubmitMode } from "./collab.js";
import { findWorldById } from "./worlds.js";
import {
  listEntries,
  toPublicEntry,
  type PublicWikiEntry,
  type WikiEntryRow,
} from "./wiki.js";

export const WORK_TYPES = [
  "novel",
  "chapter",
  "story",
  "artwork",
  "program",
  "audio",
  "video",
  "other",
] as const;

export type WorkType = (typeof WORK_TYPES)[number];
export type WorkStatus = "draft" | "pending" | "published" | "rejected";

export type WorkRow = {
  id: string;
  world_id: string;
  author_id: string;
  type: WorkType;
  category: WorkCategory;
  kind: string;
  title: string;
  summary: string | null;
  content: string | null;
  media_url: string | null;
  status: WorkStatus;
  parent_id: string | null;
  published_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type WorkFeedRow = WorkRow & {
  world_name: string;
  world_slug: string;
  author_username: string;
  author_display_name: string;
  /** Populated by attachReactionCounts; not a DB column. */
  reaction_counts?: Record<string, number>;
};

export type PublicWork = {
  id: string;
  worldId: string;
  worldName: string;
  worldSlug: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  type: WorkType;
  category: WorkCategory;
  kind: string;
  title: string;
  summary: string | null;
  content: string | null;
  mediaUrl: string | null;
  status: WorkStatus;
  parentId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reactionCounts: Record<string, number>;
};

export type WorkChapterRef = {
  id: string;
  title: string;
  publishedAt: string | null;
};

export type WorkAnnotation = PublicWikiEntry & {
  /** matched in body text vs explicit work_entry_links */
  source: "link" | "mention";
  excerpt: string;
};

export type WorkReadPayload = {
  work: PublicWork;
  novel: PublicWork | null;
  chapters: WorkChapterRef[];
  prevChapter: WorkChapterRef | null;
  nextChapter: WorkChapterRef | null;
  annotations: WorkAnnotation[];
};

export function toPublicWork(row: WorkFeedRow): PublicWork {
  return {
    id: row.id,
    worldId: row.world_id,
    worldName: row.world_name,
    worldSlug: row.world_slug,
    authorId: row.author_id,
    authorUsername: row.author_username,
    authorDisplayName: row.author_display_name,
    type: row.type,
    category: row.category,
    kind: row.kind ?? "",
    title: row.title,
    summary: row.summary,
    content: row.content,
    mediaUrl: row.media_url,
    status: row.status,
    parentId: row.parent_id,
    publishedAt: row.published_at?.toISOString() ?? null,
    createdAt: row.created_at.toISOString(),
    updatedAt: row.updated_at.toISOString(),
    reactionCounts: row.reaction_counts ?? {},
  };
}

/** Batch-fetch per-work reaction counts and attach to feed rows. */
async function attachReactionCounts<T extends { id: string }>(
  rows: T[],
): Promise<void> {
  if (rows.length === 0) return;
  const ids = rows.map((r) => r.id);
  const res = await pool.query<{
    target_id: string;
    reaction_type: string;
    n: number;
  }>(
    `SELECT target_id, reaction_type, count(*)::int AS n
       FROM reactions
      WHERE target_type = 'work' AND target_id = ANY($1::uuid[])
      GROUP BY target_id, reaction_type`,
    [ids],
  );
  const map = new Map<string, Record<string, number>>();
  for (const row of res.rows) {
    const cur = map.get(row.target_id) ?? {};
    cur[row.reaction_type] = row.n;
    map.set(row.target_id, cur);
  }
  for (const r of rows) {
    (r as T & { reaction_counts?: Record<string, number> }).reaction_counts =
      map.get(r.id) ?? {};
  }
}

const FEED_SELECT = `
  SELECT w.*,
         worlds.name AS world_name,
         worlds.slug AS world_slug,
         u.username AS author_username,
         u.display_name AS author_display_name
    FROM works w
    JOIN worlds ON worlds.id = w.world_id
    JOIN users u ON u.id = w.author_id
`;

/** Plaza feed: published works in published public worlds (chapters hidden). */
export async function listPublicWorks(limit = 40): Promise<WorkFeedRow[]> {
  const capped = Math.min(Math.max(limit, 1), 100);
  const res = await pool.query<WorkFeedRow>(
    `${FEED_SELECT}
     WHERE w.status = 'published'
       AND w.deleted_at IS NULL
       AND worlds.status = 'published'
       AND worlds.visibility = 'public'
       AND worlds.deleted_at IS NULL
       AND w.type <> 'chapter'
     ORDER BY w.published_at DESC NULLS LAST, w.created_at DESC
     LIMIT $1`,
    [capped],
  );
  const rows = res.rows;
  await attachReactionCounts(rows);
  return rows;
}

/** Public works inside a single published public world (chapters hidden). */
export async function listPublicWorksByWorld(
  worldId: string,
  limit = 24,
): Promise<WorkFeedRow[]> {
  const capped = Math.min(Math.max(limit, 1), 100);
  const res = await pool.query<WorkFeedRow>(
    `${FEED_SELECT}
     WHERE w.world_id = $1
       AND w.status = 'published'
       AND w.deleted_at IS NULL
       AND worlds.status = 'published'
       AND worlds.visibility = 'public'
       AND worlds.deleted_at IS NULL
       AND w.type <> 'chapter'
     ORDER BY w.published_at DESC NULLS LAST, w.created_at DESC
     LIMIT $2`,
    [worldId, capped],
  );
  const rows = res.rows;
  await attachReactionCounts(rows);
  return rows;
}

export async function findPublicWorkById(
  id: string,
): Promise<WorkFeedRow | null> {
  const res = await pool.query<WorkFeedRow>(
    `${FEED_SELECT}
     WHERE w.id = $1
       AND w.deleted_at IS NULL
       AND w.status = 'published'
       AND worlds.status = 'published'
       AND worlds.visibility = 'public'
       AND worlds.deleted_at IS NULL
     LIMIT 1`,
    [id],
  );
  const row = res.rows[0] ?? null;
  if (row) await attachReactionCounts([row]);
  return row;
}

/** Find any non-deleted work regardless of status (for review flows). */
export async function findAnyWorkById(id: string): Promise<WorkFeedRow | null> {
  const res = await pool.query<WorkFeedRow>(
    `${FEED_SELECT}
     WHERE w.id = $1 AND w.deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return res.rows[0] ?? null;
}

async function listPublishedChapters(
  novelId: string,
): Promise<WorkFeedRow[]> {
  const res = await pool.query<WorkFeedRow>(
    `${FEED_SELECT}
     WHERE w.parent_id = $1
       AND w.type = 'chapter'
       AND w.status = 'published'
       AND w.deleted_at IS NULL
       AND worlds.status = 'published'
       AND worlds.visibility = 'public'
       AND worlds.deleted_at IS NULL
     ORDER BY w.published_at ASC NULLS LAST, w.created_at ASC`,
    [novelId],
  );
  return res.rows;
}

function toChapterRef(row: WorkFeedRow): WorkChapterRef {
  return {
    id: row.id,
    title: row.title,
    publishedAt: row.published_at?.toISOString() ?? null,
  };
}

function excerptOf(content: string, max = 120): string {
  const plain = content.replace(/\s+/g, " ").trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}…`;
}

async function listLinkedEntries(workId: string): Promise<WikiEntryRow[]> {
  const res = await pool.query<WikiEntryRow>(
    `SELECT e.*
       FROM work_entry_links l
       JOIN wiki_entries e ON e.id = l.entry_id
      WHERE l.work_id = $1
        AND e.deleted_at IS NULL
        AND e.status = 'published'
      ORDER BY e.title`,
    [workId],
  );
  return res.rows;
}

function matchMentions(
  text: string,
  entries: WikiEntryRow[],
): WikiEntryRow[] {
  if (!text.trim()) return [];
  const hit: WikiEntryRow[] = [];
  const sorted = [...entries].sort(
    (a, b) => b.title.length - a.title.length,
  );
  for (const e of sorted) {
    if (e.category === "intro") continue;
    const names = [e.title, ...(e.aliases ?? [])].filter(
      (n) => n && n.trim().length >= 2,
    );
    if (names.some((n) => text.includes(n))) {
      hit.push(e);
    }
  }
  return hit;
}

export async function getWorkReadPayload(
  id: string,
): Promise<WorkReadPayload | null> {
  const row = await findPublicWorkById(id);
  if (!row) return null;

  const work = toPublicWork(row);
  let novel: PublicWork | null = null;
  let chapters: WorkChapterRef[] = [];
  let prevChapter: WorkChapterRef | null = null;
  let nextChapter: WorkChapterRef | null = null;

  if (row.type === "novel") {
    const chapterRows = await listPublishedChapters(row.id);
    chapters = chapterRows.map(toChapterRef);
    novel = work;
  } else if (row.type === "chapter" && row.parent_id) {
    const parent = await findPublicWorkById(row.parent_id);
    if (parent) {
      novel = toPublicWork(parent);
      const chapterRows = await listPublishedChapters(row.parent_id);
      chapters = chapterRows.map(toChapterRef);
      const idx = chapterRows.findIndex((c) => c.id === row.id);
      if (idx > 0) prevChapter = toChapterRef(chapterRows[idx - 1]);
      if (idx >= 0 && idx < chapterRows.length - 1) {
        nextChapter = toChapterRef(chapterRows[idx + 1]);
      }
    }
  }

  const linked = await listLinkedEntries(row.id);
  const worldEntries = await listEntries(row.world_id);
  const mentioned = matchMentions(row.content ?? "", worldEntries);

  const byId = new Map<string, WorkAnnotation>();
  for (const e of linked) {
    byId.set(e.id, {
      ...toPublicEntry(e),
      source: "link",
      excerpt: excerptOf(e.content),
    });
  }
  for (const e of mentioned) {
    if (byId.has(e.id)) continue;
    byId.set(e.id, {
      ...toPublicEntry(e),
      source: "mention",
      excerpt: excerptOf(e.content),
    });
  }

  return {
    work,
    novel,
    chapters,
    prevChapter,
    nextChapter,
    annotations: [...byId.values()],
  };
}

export async function createWork(input: {
  worldId: string;
  authorId: string;
  category: WorkCategory;
  kind?: string;
  title: string;
  summary?: string | null;
  content?: string | null;
  mediaUrl?: string | null;
  parentId?: string | null;
  publish?: boolean;
}): Promise<WorkFeedRow> {
  if (!isWorkCategory(input.category)) {
    throw Object.assign(new Error("无效的作品分类"), { statusCode: 400 });
  }
  const kind = (input.kind ?? "").trim().slice(0, 32);
  if (!isWorkKind(input.category, kind)) {
    throw Object.assign(new Error("无效的作品子类型"), { statusCode: 400 });
  }
  const type = structuralType(input.category, kind);

  const world = await findWorldById(input.worldId);
  if (!world) {
    throw Object.assign(new Error("世界观不存在"), { statusCode: 404 });
  }

  const mode = await getWorkSubmitMode(world.id);
  const role =
    world.creator_id === input.authorId
      ? ("creator" as const)
      : await getMemberRole(world.id, input.authorId);
  if (!canCreateWorks({ world, mode, role, userId: input.authorId })) {
    throw Object.assign(
      new Error("该世界观为仅邀请创作模式，暂不能投稿"),
      { statusCode: 403 },
    );
  }

  const title = input.title.trim().slice(0, 200);
  if (!title) {
    throw Object.assign(new Error("标题不能为空"), { statusCode: 400 });
  }

  let parentId = input.parentId?.trim() || null;
  if (type === "chapter") {
    if (!parentId) {
      throw Object.assign(new Error("章节需要所属长篇 parentId"), {
        statusCode: 400,
      });
    }
    const raw = await pool.query<WorkRow>(
      `SELECT * FROM works
       WHERE id = $1 AND world_id = $2 AND deleted_at IS NULL LIMIT 1`,
      [parentId, input.worldId],
    );
    const p = raw.rows[0];
    if (!p || p.type !== "novel") {
      throw Object.assign(new Error("所属长篇不存在"), { statusCode: 400 });
    }
  } else {
    parentId = null;
  }

  // 状态由协作模式决定：创建者可直发/存草稿；open 直接发布（平台简单审核）；
  // review / invite_only 进入 pending，等待创建者或 editor 审核。
  const publish = Boolean(input.publish);
  let status: WorkStatus;
  if (world.creator_id === input.authorId) {
    status = publish ? "published" : "draft";
  } else if (mode === "open") {
    status = "published";
  } else {
    status = "pending";
  }

  const summary = input.summary?.trim().slice(0, 500) || null;
  const content = input.content?.trim() || null;
  const mediaUrl = input.mediaUrl?.trim() || null;

  const res = await pool.query<WorkRow>(
    `INSERT INTO works (
       world_id, author_id, type, category, kind, title, summary, content,
       media_url, status, parent_id, published_at
     ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     RETURNING *`,
    [
      input.worldId,
      input.authorId,
      type,
      input.category,
      kind,
      title,
      summary,
      content,
      mediaUrl,
      status,
      parentId,
      status === "published" ? new Date() : null,
    ],
  );

  const row = res.rows[0];
  const joined = await pool.query<WorkFeedRow>(
    `${FEED_SELECT} WHERE w.id = $1 LIMIT 1`,
    [row.id],
  );
  const out = joined.rows[0];
  await attachReactionCounts([out]);
  return out;
}

/** Pending works awaiting review in a world (for creator/editor). */
export async function listPendingWorks(
  worldId: string,
): Promise<WorkFeedRow[]> {
  const res = await pool.query<WorkFeedRow>(
    `${FEED_SELECT}
     WHERE w.world_id = $1
       AND w.status = 'pending'
       AND w.deleted_at IS NULL
     ORDER BY w.created_at DESC`,
    [worldId],
  );
  await attachReactionCounts(res.rows);
  return res.rows;
}

export async function reviewWork(input: {
  workId: string;
  reviewerId: string;
  action: "approve" | "reject";
  reason?: string;
}): Promise<WorkFeedRow | null> {
  const status: WorkStatus = input.action === "approve" ? "published" : "rejected";
  const reason =
    input.action === "reject"
      ? input.reason?.trim().slice(0, 500) || null
      : null;
  const publishedAt = input.action === "approve" ? new Date() : null;

  const res = await pool.query<WorkRow>(
    `UPDATE works
        SET status = $2,
            published_at = $5,
            reject_reason = $3,
            reviewed_by = $4,
            reviewed_at = now(),
            updated_at = now()
      WHERE id = $1 AND status = 'pending' AND deleted_at IS NULL
      RETURNING *`,
    [input.workId, status, reason, input.reviewerId, publishedAt],
  );
  const row = res.rows[0];
  if (!row) return null;
  const joined = await pool.query<WorkFeedRow>(
    `${FEED_SELECT} WHERE w.id = $1 LIMIT 1`,
    [row.id],
  );
  const out = joined.rows[0];
  await attachReactionCounts([out]);
  return out;
}
