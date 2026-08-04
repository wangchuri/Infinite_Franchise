import { pool } from "./db.js";
import type { ReactionTargetType } from "./reactions.js";

export const COMMENT_MAX = 2000;

export type CommentRow = {
  id: string;
  user_id: string;
  target_type: ReactionTargetType;
  target_id: string;
  content: string;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type CommentWithAuthor = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export async function listComments(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<CommentWithAuthor[]> {
  const res = await pool.query<{
    id: string;
    user_id: string;
    username: string;
    display_name: string;
    content: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT c.id, c.user_id, u.username, u.display_name, c.content,
            c.created_at, c.updated_at
       FROM comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.target_type = $1
        AND c.target_id = $2
        AND c.deleted_at IS NULL
      ORDER BY c.created_at ASC`,
    [targetType, targetId],
  );
  return res.rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    username: r.username,
    displayName: r.display_name,
    content: r.content,
    createdAt: r.created_at.toISOString(),
    updatedAt: r.updated_at.toISOString(),
  }));
}

export async function createComment(input: {
  userId: string;
  targetType: ReactionTargetType;
  targetId: string;
  content: string;
}): Promise<CommentWithAuthor> {
  const content = input.content.trim().slice(0, COMMENT_MAX);
  if (!content) {
    throw Object.assign(new Error("评论内容不能为空"), { statusCode: 400 });
  }

  const res = await pool.query<CommentRow>(
    `INSERT INTO comments (user_id, target_type, target_id, content)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [input.userId, input.targetType, input.targetId, content],
  );
  const row = res.rows[0];

  const joined = await pool.query<{
    id: string;
    user_id: string;
    username: string;
    display_name: string;
    content: string;
    created_at: Date;
    updated_at: Date;
  }>(
    `SELECT c.id, c.user_id, u.username, u.display_name, c.content,
            c.created_at, c.updated_at
       FROM comments c
       JOIN users u ON u.id = c.user_id
      WHERE c.id = $1 LIMIT 1`,
    [row.id],
  );
  const j = joined.rows[0];
  return {
    id: j.id,
    userId: j.user_id,
    username: j.username,
    displayName: j.display_name,
    content: j.content,
    createdAt: j.created_at.toISOString(),
    updatedAt: j.updated_at.toISOString(),
  };
}

/** Soft-delete a comment; only the author may delete it. */
export async function deleteComment(
  commentId: string,
  userId: string,
): Promise<"deleted" | "not_found"> {
  const res = await pool.query(
    `UPDATE comments
        SET deleted_at = now(), updated_at = now()
      WHERE id = $1
        AND user_id = $2
        AND deleted_at IS NULL`,
    [commentId, userId],
  );
  return (res.rowCount ?? 0) > 0 ? "deleted" : "not_found";
}
