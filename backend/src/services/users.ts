import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "../db.js";

export type UserRow = {
  id: string;
  username: string;
  email: string;
  email_verified_at: Date | null;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  contact_email: string | null;
  link_url: string | null;
  status: string;
  last_login_at: Date | null;
  created_at: Date;
  updated_at: Date;
  deleted_at: Date | null;
};

export type PublicUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  contactEmail: string | null;
  linkUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
};

export function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    contactEmail: row.contact_email,
    linkUrl: row.link_url,
    emailVerified: row.email_verified_at != null,
    createdAt: row.created_at.toISOString(),
  };
}

export async function findUserByEmailOrUsername(
  login: string,
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users
     WHERE deleted_at IS NULL
       AND (lower(email) = lower($1) OR lower(username) = lower($1))
     LIMIT 1`,
    [login],
  );
  return result.rows[0] ?? null;
}

export type UserSearchItem = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

/** Case-insensitive search by username / display name (excludes the caller). */
export async function searchUsers(
  query: string,
  excludeId: string | null,
  limit = 8,
): Promise<UserSearchItem[]> {
  const escaped = query.replace(/[\\%_]/g, (m) => `\\${m}`);
  const res = await pool.query<{
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
  }>(
    `SELECT id, username, display_name, avatar_url
       FROM users
      WHERE deleted_at IS NULL
        AND status = 'active'
        AND (username ILIKE $1 OR display_name ILIKE $1)
        AND ($2::uuid IS NULL OR id <> $2)
      ORDER BY username ASC
      LIMIT $3`,
    [`%${escaped}%`, excludeId, limit],
  );
  return res.rows.map((r) => ({
    id: r.id,
    username: r.username,
    displayName: r.display_name,
    avatarUrl: r.avatar_url,
  }));
}

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
}

export async function findUserByUsername(
  username: string,
): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users
      WHERE lower(username) = lower($1)
        AND status = 'active'
        AND deleted_at IS NULL
      LIMIT 1`,
    [username],
  );
  return result.rows[0] ?? null;
}

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  contactEmail: string | null;
  linkUrl: string | null;
  createdAt: string;
  works: number;
  followers: number;
  following: number;
};

export function toUserProfile(
  row: UserRow,
  stats: { works: number; followers: number; following: number },
): UserProfile {
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    avatarUrl: row.avatar_url,
    bio: row.bio,
    contactEmail: row.contact_email,
    linkUrl: row.link_url,
    createdAt: row.created_at.toISOString(),
    ...stats,
  };
}

export async function getUserProfileStats(
  userId: string,
): Promise<{ works: number; followers: number; following: number }> {
  const res = await pool.query<{
    works: string;
    followers: string;
    following: string;
  }>(
    `SELECT
       (SELECT count(*) FROM works w
         WHERE w.author_id = $1
           AND w.status = 'published'
           AND w.deleted_at IS NULL
           AND w.type <> 'chapter') AS works,
       (SELECT count(*) FROM user_follows f WHERE f.followee_id = $1) AS followers,
       (SELECT count(*) FROM user_follows f WHERE f.follower_id = $1) AS following`,
    [userId],
  );
  const r = res.rows[0];
  return {
    works: Number(r?.works ?? 0),
    followers: Number(r?.followers ?? 0),
    following: Number(r?.following ?? 0),
  };
}

export async function updateUserProfile(
  userId: string,
  patch: {
    displayName?: string;
    bio?: string | null;
    contactEmail?: string | null;
    linkUrl?: string | null;
    avatarUrl?: string | null;
  },
): Promise<UserRow> {
  const fields: string[] = [];
  const values: unknown[] = [];
  let i = 1;
  const set = (col: string, val: unknown) => {
    fields.push(`${col} = $${i++}`);
    values.push(val);
  };
  if (patch.displayName !== undefined) set("display_name", patch.displayName);
  if (patch.bio !== undefined) set("bio", patch.bio);
  if (patch.contactEmail !== undefined) set("contact_email", patch.contactEmail);
  if (patch.linkUrl !== undefined) set("link_url", patch.linkUrl);
  if (patch.avatarUrl !== undefined) set("avatar_url", patch.avatarUrl);

  if (fields.length === 0) {
    const current = await findUserById(userId);
    return current as UserRow;
  }
  fields.push("updated_at = now()");
  values.push(userId);
  const res = await pool.query<UserRow>(
    `UPDATE users SET ${fields.join(", ")}
      WHERE id = $${i} AND deleted_at IS NULL
      RETURNING *`,
    values,
  );
  return res.rows[0];
}

export async function followUser(
  followerId: string,
  followeeId: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO user_follows (follower_id, followee_id)
     VALUES ($1, $2) ON CONFLICT DO NOTHING`,
    [followerId, followeeId],
  );
}

export async function unfollowUser(
  followerId: string,
  followeeId: string,
): Promise<void> {
  await pool.query(
    `DELETE FROM user_follows WHERE follower_id = $1 AND followee_id = $2`,
    [followerId, followeeId],
  );
}

export async function isFollowing(
  followerId: string,
  followeeId: string,
): Promise<boolean> {
  const res = await pool.query(
    `SELECT 1 FROM user_follows WHERE follower_id = $1 AND followee_id = $2`,
    [followerId, followeeId],
  );
  return (res.rowCount ?? 0) > 0;
}

export async function createUser(input: {
  username: string;
  email: string;
  passwordHash: string;
  displayName: string;
}): Promise<UserRow> {
  const result = await pool.query<UserRow>(
    `INSERT INTO users (username, email, password_hash, display_name)
     VALUES ($1, $2, $3, $4)
     RETURNING *`,
    [
      input.username,
      input.email.toLowerCase(),
      input.passwordHash,
      input.displayName,
    ],
  );
  return result.rows[0];
}

export async function touchLastLogin(userId: string): Promise<void> {
  await pool.query(
    `UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = $1`,
    [userId],
  );
}

export async function createSession(input: {
  userId: string;
  refreshTokenHash: string;
  expiresAt: Date;
  userAgent?: string | null;
  ip?: string | null;
}): Promise<void> {
  await pool.query(
    `INSERT INTO user_sessions (user_id, refresh_token_hash, user_agent, ip, expires_at)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      input.userId,
      input.refreshTokenHash,
      input.userAgent ?? null,
      input.ip ?? null,
      input.expiresAt,
    ],
  );
}

export async function withTransaction<T>(
  fn: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const value = await fn(client);
    await client.query("COMMIT");
    return value;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

export async function queryOne<T extends QueryResultRow>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const result = await pool.query<T>(text, params);
  return result.rows[0] ?? null;
}
