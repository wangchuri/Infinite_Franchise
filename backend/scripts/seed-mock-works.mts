import "dotenv/config";
import { pool } from "../src/db.ts";

/**
 * Seed sample published works for plaza feed.
 * Requires: migrated DB, mock users, at least one published public world.
 */
const SAMPLES: Array<{
  type: string;
  title: string;
  summary: string;
  content: string;
}> = [
  {
    type: "story",
    title: "离港通知书",
    summary: "雾散之前，码头只留下一张未署名的离港单。",
    content:
      "潮水退到第三道标线时，灯塔才亮起。\n\n通知书没有署名，只有一行字：今晚离港，勿问归期。",
  },
  {
    type: "story",
    title: "雨夜档案",
    summary: "档案室的灯坏了三天，雨却一直没停。",
    content:
      "他把湿透的外套挂在铁架上，翻开编号 47 的卷宗。\n\n页脚有一行铅笔字：别相信港口的钟。",
  },
  {
    type: "artwork",
    title: "沙海停战（概念图）",
    summary: "停火线画在沙丘背风面，风一吹就没了。",
    content: "（美术占位：可在编辑器中替换为实际上传图。）",
  },
];

async function main() {
  const worldRes = await pool.query<{
    id: string;
    name: string;
    creator_id: string;
  }>(
    `SELECT id, name, creator_id FROM worlds
     WHERE status = 'published' AND visibility = 'public' AND deleted_at IS NULL
     ORDER BY updated_at DESC
     LIMIT 5`,
  );

  if (!worldRes.rowCount) {
    console.log("no published public worlds — publish a world first, then re-run");
    await pool.end();
    return;
  }

  let created = 0;
  for (let i = 0; i < SAMPLES.length; i++) {
    const sample = SAMPLES[i];
    const world = worldRes.rows[i % worldRes.rows.length];

    const exists = await pool.query(
      `SELECT 1 FROM works
       WHERE world_id = $1 AND title = $2 AND deleted_at IS NULL
       LIMIT 1`,
      [world.id, sample.title],
    );
    if (exists.rowCount) {
      console.log(`skip existing «${sample.title}» @ ${world.name}`);
      continue;
    }

    await pool.query(
      `INSERT INTO works (
         world_id, author_id, type, title, summary, content,
         status, published_at
       ) VALUES ($1, $2, $3, $4, $5, $6, 'published', now() - ($7 || ' hours')::interval)`,
      [
        world.id,
        world.creator_id,
        sample.type,
        sample.title,
        sample.summary,
        sample.content,
        String(i * 6 + 2),
      ],
    );
    created += 1;
    console.log(`created «${sample.title}» → ${world.name}`);
  }

  await pool.end();
  console.log(`seed works done (${created} new)`);
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
