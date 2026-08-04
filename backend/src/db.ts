import { Pool } from "pg";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env and configure it.");
}

export const pool = new Pool({
  connectionString,
});

export async function checkDatabase(): Promise<{
  ok: boolean;
  database?: string;
  user?: string;
  error?: string;
}> {
  try {
    const result = await pool.query<{
      database: string;
      db_user: string;
    }>("SELECT current_database() AS database, current_user AS db_user");
    const row = result.rows[0];
    return {
      ok: true,
      database: row.database,
      user: row.db_user,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown database error";
    return {
      ok: false,
      error: message,
    };
  }
}
