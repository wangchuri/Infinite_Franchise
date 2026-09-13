import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "../src/db.ts";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const mdPath = path.resolve(__dirname, "../../docs/清玲之歌.md");

async function main() {
  const raw = fs.readFileSync(mdPath, "utf8").replace(/^\uFEFF/, "").trim();
  if (!raw) throw new Error("empty markdown");

  // Prefer world named 清玲之歌; else any published public world
  let world = (
    await pool.query<{ id: string; name: string; creator_id: string }>(
      `SELECT id, name, creator_id FROM worlds
       WHERE deleted_at IS NULL AND name LIKE '%清玲%'
       ORDER BY CASE WHEN status = 'published' THEN 0 ELSE 1 END, updated_at DESC
       LIMIT 1`,
    )
  ).rows[0];

  if (!world) {
    world = (
      await pool.query<{ id: string; name: string; creator_id: string }>(
        `SELECT id, name, creator_id FROM worlds
         WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT 1`,
      )
    ).rows[0];
  }

  if (!world) {
    console.log("no world found");
    await pool.end();
    return;
  }

  const title = "清玲之歌";
  const summary =
    "一本掉落的笔记，娟秀字迹里写着神明与另一个世界的故事——我冒昧地叫它「清铃之歌」。";

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM works
     WHERE world_id = $1 AND title = $2 AND type = 'story' AND deleted_at IS NULL
     LIMIT 1`,
    [world.id, title],
  );

  if (existing.rowCount) {
    await pool.query(
      `UPDATE works
          SET content = $1,
              summary = $2,
              category = 'novel',
              kind = 'short',
              status = 'published',
              published_at = COALESCE(published_at, now()),
              updated_at = now()
        WHERE id = $3`,
      [raw, summary, existing.rows[0].id],
    );
    console.log(`updated story «${title}» @ ${world.name} id=${existing.rows[0].id}`);
  } else {
    const ins = await pool.query<{ id: string }>(
      `INSERT INTO works (
         world_id, author_id, type, category, kind, title, summary, content,
         status, published_at
       ) VALUES ($1, $2, 'story', 'novel', 'short', $3, $4, $5, 'published', now())
       RETURNING id`,
      [world.id, world.creator_id, title, summary, raw],
    );
    console.log(`created story «${title}» @ ${world.name} id=${ins.rows[0].id}`);
  }

  await pool.end();
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
