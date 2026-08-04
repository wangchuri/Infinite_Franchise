import type { PoolClient, QueryResultRow } from "pg";
import { pool } from "./db.js";

export type UserRow = {
  id: string;
  username: string;
  email: string;
  email_verified_at: Date | null;
  password_hash: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
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

export async function findUserById(id: string): Promise<UserRow | null> {
  const result = await pool.query<UserRow>(
    `SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1`,
    [id],
  );
  return result.rows[0] ?? null;
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
