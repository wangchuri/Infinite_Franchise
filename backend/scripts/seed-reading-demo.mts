import "dotenv/config";
import { pool } from "../src/db.ts";

/**
 * Seed a long novel with chapters + ensure short stories mention wiki names
 * so reading annotations can demo.
 */
async function main() {
  const worldRes = await pool.query<{
    id: string;
    name: string;
    creator_id: string;
  }>(
    `SELECT id, name, creator_id FROM worlds
     WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 1`,
  );
  if (!worldRes.rowCount) {
    console.log("no published world — skip");
    await pool.end();
    return;
  }
  const world = worldRes.rows[0];

  // Ensure a character entry exists for mention matching
  const entry = await pool.query<{ id: string; title: string }>(
    `SELECT id, title FROM wiki_entries
     WHERE world_id = $1 AND category = 'character' AND deleted_at IS NULL
     LIMIT 1`,
    [world.id],
  );
  let charName = entry.rows[0]?.title ?? "守夜人";
  if (!entry.rowCount) {
    const ins = await pool.query<{ id: string; title: string }>(
      `INSERT INTO wiki_entries (
         world_id, category, title, slug, content, status, created_by, updated_by
       ) VALUES ($1, 'character', '守夜人', 'shou-ye-ren',
         '灯塔值班的守夜人。雾港最晚熄灯的人。', 'published', $2, $2)
       RETURNING id, title`,
      [world.id, world.creator_id],
    );
    charName = ins.rows[0].title;
    console.log(`created wiki character «${charName}»`);
  }

  const novelTitle = "灯塔值班手记";
  let novelId: string;
  const existingNovel = await pool.query<{ id: string }>(
    `SELECT id FROM works
     WHERE world_id = $1 AND title = $2 AND type = 'novel' AND deleted_at IS NULL
     LIMIT 1`,
    [world.id, novelTitle],
  );
  if (existingNovel.rowCount) {
    novelId = existingNovel.rows[0].id;
    console.log(`skip novel «${novelTitle}»`);
  } else {
    const n = await pool.query<{ id: string }>(
      `INSERT INTO works (
         world_id, author_id, type, title, summary, content,
         status, published_at
       ) VALUES ($1, $2, 'novel', $3, $4, $5, 'published', now() - interval '2 days')
       RETURNING id`,
      [
        world.id,
        world.creator_id,
        novelTitle,
        "雾港灯塔的值班记录，按航次编号。",
        null,
      ],
    );
    novelId = n.rows[0].id;
    console.log(`created novel «${novelTitle}»`);
  }

  const chapters = [
    {
      title: "第一航次 · 雾起",
      content: `潮水退到第三道标线时，灯塔才亮起。\n\n${charName}把湿透的外套挂在铁架上，翻开编号 01 的值班簿。\n\n页脚有一行铅笔字：别相信港口的钟。`,
    },
    {
      title: "第二航次 · 离港",
      content: `通知书没有署名，只有一行字：今晚离港，勿问归期。\n\n${charName}站在栏杆边，看雾把码头吞掉一半。灯塔的光扫过三次，船影才真正离开。`,
    },
    {
      title: "第三航次 · 回声",
      content: `档案室的灯坏了三天，雨却一直没停。\n\n${charName}听见塔底有人喊自己的名字——可值班簿上，今夜只有他一个人。`,
    },
  ];

  for (let i = 0; i < chapters.length; i++) {
    const ch = chapters[i];
    const exists = await pool.query(
      `SELECT 1 FROM works
       WHERE parent_id = $1 AND title = $2 AND deleted_at IS NULL LIMIT 1`,
      [novelId, ch.title],
    );
    if (exists.rowCount) {
      console.log(`skip chapter «${ch.title}»`);
      continue;
    }
    await pool.query(
      `INSERT INTO works (
         world_id, author_id, type, title, content, parent_id,
         status, published_at
       ) VALUES ($1, $2, 'chapter', $3, $4, $5, 'published',
                 now() - ($6 || ' hours')::interval)`,
      [world.id, world.creator_id, ch.title, ch.content, novelId, String((3 - i) * 8)],
    );
    console.log(`created chapter «${ch.title}»`);
  }

  // Link first chapter to character if we have entry id
  const charId =
    entry.rows[0]?.id ??
    (
      await pool.query<{ id: string }>(
        `SELECT id FROM wiki_entries WHERE world_id = $1 AND title = $2 LIMIT 1`,
        [world.id, charName],
      )
    ).rows[0]?.id;

  if (charId) {
    const ch1 = await pool.query<{ id: string }>(
      `SELECT id FROM works WHERE parent_id = $1 ORDER BY published_at ASC LIMIT 1`,
      [novelId],
    );
    if (ch1.rowCount) {
      await pool.query(
        `INSERT INTO work_entry_links (work_id, entry_id)
         VALUES ($1, $2) ON CONFLICT DO NOTHING`,
        [ch1.rows[0].id, charId],
      );
      console.log("linked chapter ↔ wiki entry");
    }
  }

  await pool.end();
  console.log("seed reading demo done");
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
