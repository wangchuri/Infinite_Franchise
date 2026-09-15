import { pool } from "../db.js";

export const TOPIC_TITLE_MAX = 160;
export const TOPIC_BODY_MAX = 20000;

export type TopicStatus = "open" | "resolved";
export type TopicSort = "latest" | "hot";

export type TopicFeedRow = {
  id: string;
  world_id: string;
  author_id: string;
  title: string;
  body: string;
  status: TopicStatus;
  pinned: boolean;
  created_at: Date;
  updated_at: Date;
  author_username: string;
  author_display_name: string;
  comment_count: number;
};

export type PublicTopic = {
  id: string;
  worldId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  title: string;
  body: string;
  status: TopicStatus;
  pinned: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export function toPublicTopic(r: TopicFeedRow): PublicTopic {
  return {
    id: r.id,
    worldId: r.world_id,
    authorId: r.author_id,
    authorUsername: r.author_username,
    authorDisplayName: r.author_display_name,
    title: r.title,
    body: r.body,
    status: r.status,
    pinned: r.pinned,
    commentCount: r.comment_count,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  };
}

const TOPIC_SELECT = `
  SELECT t.*,
         u.username AS author_username,
         u.display_name AS author_display_name,
         (SELECT count(*)::int FROM comments c
           WHERE c.target_type = 'topic'
             AND c.target_id = t.id
             AND c.deleted_at IS NULL) AS comment_count
    FROM world_topics t
    JOIN users u ON u.id = t.author_id`;

export async function listTopics(
  worldId: string,
  opts: { status?: TopicStatus; sort?: TopicSort } = {},
): Promise<PublicTopic[]> {
  const order =
    opts.sort === "hot"
      ? `ORDER BY t.pinned DESC, comment_count DESC, t.created_at DESC`
      : `ORDER BY t.pinned DESC, t.created_at DESC`;
  const res = await pool.query<TopicFeedRow>(
    `${TOPIC_SELECT}
      WHERE t.world_id = $1
        AND t.deleted_at IS NULL
        AND ($2::text IS NULL OR t.status = $2)
      ${order}`,
    [worldId, opts.status ?? null],
  );
  return res.rows.map(toPublicTopic);
}

export async function findTopicById(id: string): Promise<PublicTopic | null> {
  const res = await pool.query<TopicFeedRow>(
    `${TOPIC_SELECT} WHERE t.id = $1 AND t.deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return res.rows[0] ? toPublicTopic(res.rows[0]) : null;
}

export async function findTopicRow(id: string): Promise<{
  id: string;
  world_id: string;
  author_id: string;
  status: TopicStatus;
  pinned: boolean;
} | null> {
  const res = await pool.query<{
    id: string;
    world_id: string;
    author_id: string;
    status: TopicStatus;
    pinned: boolean;
  }>(
    `SELECT id, world_id, author_id, status, pinned
       FROM world_topics WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return res.rows[0] ?? null;
}

export async function createTopic(input: {
  worldId: string;
  authorId: string;
  title: string;
  body: string;
}): Promise<PublicTopic> {
  const title = input.title.trim().slice(0, TOPIC_TITLE_MAX);
  const body = input.body.slice(0, TOPIC_BODY_MAX);
  const res = await pool.query<{ id: string }>(
    `INSERT INTO world_topics (world_id, author_id, title, body)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [input.worldId, input.authorId, title, body],
  );
  return (await findTopicById(res.rows[0].id))!;
}

export async function updateTopic(
  id: string,
  patch: { title?: string; body?: string; status?: TopicStatus },
): Promise<PublicTopic | null> {
  const res = await pool.query(
    `UPDATE world_topics
        SET title  = COALESCE($2, title),
            body   = COALESCE($3, body),
            status = COALESCE($4, status),
            updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL`,
    [
      id,
      patch.title !== undefined ? patch.title.trim().slice(0, TOPIC_TITLE_MAX) : null,
      patch.body !== undefined ? patch.body.slice(0, TOPIC_BODY_MAX) : null,
      patch.status ?? null,
    ],
  );
  if ((res.rowCount ?? 0) === 0) return null;
  return findTopicById(id);
}

export async function setTopicPinned(
  id: string,
  pinned: boolean,
): Promise<PublicTopic | null> {
  const res = await pool.query(
    `UPDATE world_topics SET pinned = $2, updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL`,
    [id, pinned],
  );
  if ((res.rowCount ?? 0) === 0) return null;
  return findTopicById(id);
}

export async function softDeleteTopic(id: string): Promise<boolean> {
  const res = await pool.query(
    `UPDATE world_topics SET deleted_at = now(), updated_at = now()
      WHERE id = $1 AND deleted_at IS NULL`,
    [id],
  );
  return (res.rowCount ?? 0) > 0;
}
