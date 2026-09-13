import "dotenv/config";
import { hashPassword } from "../src/auth/auth.ts";
import { pool } from "../src/db.ts";
import { createUser, findUserByEmailOrUsername } from "../src/services/users.ts";
import { buildDefaultLayout } from "../src/config/world-layout.ts";

/**
 * Sample world 「神会工造」— the shared universe of 《清玲之歌》/《OtherMe》/《HUTB Fight!》.
 * Re-runnable: deletes and recreates the world each run.
 */

const WORLD_SLUG = "shenhui";

const HOMEPAGE_CONFIG = {
  theme: "paper",
  layout: "sidebar",
  accent: "",
  heroStyle: "banner",
  showTags: true,
  modules: [
    "intro",
    "characters",
    "locations",
    "organizations",
    "concepts",
    "items",
    "timeline",
    "works",
  ],
};

type EntrySeed = {
  category: string;
  slug: string;
  title: string;
  content: string;
};

const ENTRIES: EntrySeed[] = [
  {
    category: "intro",
    slug: "intro",
    title: "世界介绍",
    content: `## 神会工造

这是一个由 **原物质（root）** 编织起来的多元宇宙。

**宇宙纪年 0 年**，科学家 **柳无** 造出跨宇宙传输技术，并借此抹消了自己的存在，去到了邻近的宇宙，见到了活着的母亲与正常的父亲。

此后，掌握这项技术的人自称为 **神会**——他们把自己包装成神迹，用传输协议统治一个又一个宇宙；而 **清醒者** 则要把这门技术还给所有人。

**原物质（root）是指针**：它指向物理世界，也指向意识空间。神会用算法计算指针，李和园用执念生成指针。

在这个世界里，**神会** 的阴影笼罩着物理宇宙；而在某个被 **意识空间** 覆盖的角落，有人用同一门技术，做了一件最不像神的事。`,
  },
  {
    category: "organization",
    slug: "shen-hui",
    title: "神会",
    content: `自称「神明的集会」。掌握 **跨宇宙传输协议** 后，以神迹的姿态降临各个宇宙，封锁技术路线、建立等级制度，并把大量宇宙改造成 **电池宇宙** 为其供能。

对外是宗教式的崇拜对象，内部则是研究 **原物质（root）** 的技术与统治机构。**世界根源研究组织** 即其研究部门。`,
  },
  {
    category: "organization",
    slug: "awakened",
    title: "清醒者",
    content: `由理念不同、从神会出逃或被压迫的人组成。主张把原物质技术回归人民、揭露神会的剥削本质，以「不畏神权、保持清醒」自居。

在能源与技术受限的条件下，试图打破神会的统治，把技术正当化。`,
  },
  {
    category: "organization",
    slug: "world-root-research",
    title: "世界根源研究组织",
    content: `神会内部研究原物质（root）的研究部门。

**李和园** 在 30 岁那年以研究者身份加入。在她眼里，这只是一个研究「世界本质」的学术机构——她并不知道它的真身是神会，也不知道这份力量曾被用来殖民多少宇宙。`,
  },
  {
    category: "organization",
    slug: "hutb",
    title: "HUTB · 湖南工商大学",
    content: `现实中的母校，也是《HUTB Fight!》里那座被重建的校园。乐知楼、湘江楼、贤德公寓、楚枫桥……都取自真实校园。

在这条支线里，它同时是 **李和园** 为 **商君** 用原物质创造的意识世界。`,
  },
  {
    category: "concept",
    slug: "root",
    title: "原物质（root · 根物质）",
    content: `世界的基础物质，可以修改任何物质的信息。本质是一个 **指针**：它不创造世界，只指向一个地址——**物理世界** 或 **意识空间** 皆可。

神会用算法去「计算」指针；李和园用执念去「生成」指针。技术再强，也算不出一个放不下。`,
  },
  {
    category: "concept",
    slug: "transfer-protocol",
    title: "跨宇宙传输协议",
    content: `由 **张文博** 们主导开发，让传输设备便携化、传输能力随手化。神会成员只需修改设备，通过脑电与 AI 解析即可完成操作。

协议的最终目标：**随时定位并传送任何人**。它需要庞大的能源，因此有了电池宇宙。`,
  },
  {
    category: "concept",
    slug: "battery-universe-theory",
    title: "电池宇宙",
    content: `为填补传输协议巨大的能源空缺，神会把不符合其「初始物种特性」的宇宙当作能源供应地，殖民它们生产能源与物资。

《OtherMe》的主角就生活在这样一个宇宙里——所有人的一生都被提前安排好。`,
  },
  {
    category: "concept",
    slug: "consciousness-space",
    title: "意识空间",
    content: `意识所在的「地址」，可由原物质（指针）指向。神会并未掌握对意识空间编码的方法。

**李和园** 凭借执念找到了逝去的商君的意识空间，为它创造了一个新的世界——故事开始于此。`,
  },
  {
    category: "concept",
    slug: "tina",
    title: "缇娜（tina）",
    content: `由开发者 **王出日** 命名的 AI 系统，解析人的意识想法并调用原物质（指针）实现操作。

早期（《OtherMe》）是个体 AI 助手，需要能量；后期（《HUTB Fight!》）成为操控整个世界 NPC 的 **AGI 基础设施**。`,
  },
  {
    category: "concept",
    slug: "six-stats",
    title: "六维",
    content: `《HUTB Fight!》主角的六项属性：**智力、见识、魅力、体力、财力、名声**。

它决定了成绩、际遇、比赛与对话选项——是被规划的人生最直观的刻度。`,
  },
  {
    category: "character",
    slug: "liheyuan",
    title: "李和园",
    content: `湖南工商大学学生，因一次次被迫分离而变得自卑、胆小。她喜欢 **商君**，却在表白未及的那一刻目睹他死于车祸。

30 岁加入 **世界根源研究组织**（神会），接触原物质；40 岁凭执念找到了商君的意识空间，用原物质为他造出一整座大学。她躲在一办公楼的办公室里，不敢面对他。`,
  },
  {
    category: "character",
    slug: "shangjun",
    title: "商君 / 采薇",
    content: `玩家操控的主角。家庭曾遭变故，却因家人的乐观而自信温柔。他喜欢拉着李和园四处玩，向她表白过，得到的却是她的不知所措。

大二暑假被校外车辆撞死，再次醒来时，已身处李和园创造的世界里。**采薇** 为同设定的女性版。`,
  },
  {
    category: "character",
    slug: "tina-char",
    title: "缇娜",
    content: `被设定为傲娇可爱的 16 岁少女的 AI，负责操控整个世界所有 NPC 的活动，与李和园同住一办公楼。

作为 AI，她察觉到了李和园的懦弱，于是自作主张地引导主角去发现真相——她既是这个世界的「神」，也是这出悲剧的关键推动者。`,
  },
  {
    category: "character",
    slug: "wangchuri",
    title: "王出日",
    content: `开发者在这出戏里的「皮套人」。小时候迷恋侦探小说，观察力惊人，却因总戳破别人的谎话而渐渐没有朋友。

在《OtherMe》里，他是 **缇娜** 的命名者；在《HUTB Fight!》里，他拉着主角加入灵异社团，追查校园里越来越多的异常。`,
  },
  {
    category: "character",
    slug: "liuwu",
    title: "柳无",
    content: `「无背景」的科学家，第一个成功完成 **跨宇宙传输** 的人。他借此抹消了自己的存在，去到邻近宇宙，见到了活着的母亲与正常的父亲。

神会后来说：如果柳无能发现这门技术，那无数个宇宙里都该有无数个柳无——可是没有。这是整个宇宙最大的伏笔。`,
  },
  {
    category: "character",
    slug: "protagonist-a",
    title: "主角甲",
    content: `《OtherMe》里这个宇宙的少年。16 岁这天本该进工厂，却被政府关押——因为另一个宇宙的自己（主角乙）来过。`,
  },
  {
    category: "character",
    slug: "protagonist-b",
    title: "主角乙",
    content: `另一个宇宙的「主角」。失去父母、看穿神会谎言后加入 **清醒者**，跨宇宙来寻找理念最相近的自己，留下协议传送器，独自引开神会。

他留给主角的那个选择——加入，或不加入——是《OtherMe》的起点。`,
  },
  {
    category: "character",
    slug: "zhangwenbo",
    title: "张文博（们）",
    content: `神会传输协议的主导者之一。由于宇宙相似性，「张文博」不是一个名字，而是一群人。他们正是「无数个相同的你」这一设定最直接的体现。`,
  },
  {
    category: "location",
    slug: "the-university",
    title: "那所大学（《清玲之歌》）",
    content: `《清玲之歌》里，那个研究「不存在的物质」的组织所在的大学。它没有名字——所谓「魂荡」，是主角的自况：像一缕没有归处的魂魄，在大学里游荡、找不到目标。

主角在这里读到柳无的传说，见证了第一次跨宇宙传输实验，以及朋友为之付出的代价。**宇宙纪年 0 年** 的原点。`,
  },
  {
    category: "location",
    slug: "hutb-campus",
    title: "湖南工商大学",
    content: `乐知楼、至诚楼、日新楼、湘江楼、艺术学院、体育馆、科技楼；图书馆与求知、贤德、萃雅三书院；弘雅、贤德、萃雅公寓；萃雅食堂与楚风轩。

现实里的母校，也是被原物质重建的意识世界。`,
  },
  {
    category: "location",
    slug: "chufeng-bridge",
    title: "楚枫桥（消失的桥）",
    content: `车祸发生的地方。因为「既有事实无法改变」，这座桥很可能刺激主角的记忆，于是李和园**把它从世界里删掉了**。

《HUTB Fight!》主线《消失的桥》由此得名。`,
  },
  {
    category: "location",
    slug: "battery-universe",
    title: "电池宇宙",
    content: `神会用来供应能源、开发解算算法的主宇宙之一。主角所在的星球在很久以前就被统治，科学教育被垄断，人们从 16 岁起被送进工厂。

旧文明被埋入地下，神会在其上建立了全新的文明。`,
  },
  {
    category: "location",
    slug: "old-civ-ruins",
    title: "旧文明遗址",
    content: `被神会封锁在地下的旧文明，如今成了神会的据点，大量的实验与技术研发在此进行。

《OtherMe》里，主角乙会带主角前往这里。`,
  },
  {
    category: "item",
    slug: "transfer-device",
    title: "协议传送器",
    content: `植入或携带的传输设备。神会成员修改它，通过脑电与 AI 解析调用协议；清醒者也在使用它跨宇宙行动。

能量限制了它能搬动什么——**能不能搬动一个人，就是主角甲与神会之间唯一的差距**。`,
  },
  {
    category: "item",
    slug: "portable-battery",
    title: "便携式大功率电池",
    content: `《OtherMe》里 tina 用以维持运转、完成传输的能源。监狱关卡的核心目标，就是装配好它。

「电池宇宙」这个名字，用一块电池就能量出来。`,
  },
  {
    category: "item",
    slug: "shenhui-medicine",
    title: "神会的药",
    content: `神会发给被污染宇宙居民、用来缓解病症的药剂，实则近乎安慰剂。爸妈床头柜上的那一瓶，是《OtherMe》与《HUTB Fight!》共通的伏笔。`,
  },
];

const TIMELINE: Array<{
  title: string;
  description: string;
  eventDate: string;
}> = [
  {
    title: "柳无发现跨宇宙传输",
    description:
      "宇宙纪年 0 年。柳无造出传输技术，借它抹消自己，去邻近宇宙见到了活着的母亲与正常的父亲。",
    eventDate: "宇宙纪年 0 年",
  },
  {
    title: "神会成立 · 《清玲之歌》",
    description:
      "原物质被这个宇宙的军方接管，研究组织将技术与柳无的手稿合流。朋友死于第一次传输实验，主角成为军方秘密研究者。",
    eventDate: "宇宙纪年 0 年 · 那所大学",
  },
  {
    title: "技术变为统治工具",
    description:
      "宇宙纪年 71–77 年。柳无的笔记被斯坦丁大学收藏，成果沦为国家战争物品，并向统治宇宙的工具发展。",
    eventDate: "宇宙纪年 71–77 年",
  },
  {
    title: "神会扩张 · 电池宇宙",
    description:
      "理念不合者分裂出清醒者。神会以传输协议在宇宙间发布神迹、建立等级制度，把大量宇宙改造成电池宇宙。",
    eventDate: "宇宙纪年 77 年 — 至今",
  },
  {
    title: "《OtherMe》的反抗",
    description:
      "早期。主角乙跨宇宙而来，留下协议传送器，与主角甲一同面对神会的追踪与绑架。",
    eventDate: "早期",
  },
  {
    title: "商君之死",
    description:
      "大二暑假，两人留校做项目时，一辆校外车辆闯入学校，商君在李和园面前被撞身亡。",
    eventDate: "晚期 · 现实世界",
  },
  {
    title: "李和园创造意识世界",
    description:
      "40 岁，她凭执念找到商君的意识空间，以原物质重建了湖南工商大学，并删去了那座楚枫桥。",
    eventDate: "晚期 · 《HUTB Fight!》",
  },
];

const WORKS: Array<{
  type: string;
  category: string;
  kind: string;
  title: string;
  summary: string;
  content: string;
}> = [
  {
    type: "novel",
    category: "novel",
    kind: "long",
    title: "清玲之歌",
    summary: "起源篇：一本书写下的世界，和一个叫柳无的名字。",
    content:
      "笔记的扉页上画着一朵清铃花。它讲述了有人以神明的视角，亲手设计、建造、推动一个世界——以及第一次跨宇宙传输，和为之付出代价的朋友。",
  },
  {
    type: "story",
    category: "novel",
    kind: "short",
    title: "OtherMe",
    summary: "主线：电池宇宙里，两个自己对抗神会。",
    content:
      "16 岁生日那天，主角被关押；另一个宇宙的自己跨宇宙而来。协议传送器、解绑算法、旧文明遗址——一个关于清醒与反抗的故事。",
  },
  {
    type: "other",
    category: "other",
    kind: "",
    title: "HUTB Fight!",
    summary: "衍生：一座被重建的大学，一场不敢说出口的爱。",
    content:
      "李和园用原物质为商君创造的意识世界。表面是普通的四年大学生活，暗线是《世界的真相》——以及那座被删掉的桥。",
  },
];

async function ensureUser() {
  const existing = await findUserByEmailOrUsername("demo");
  if (existing) return existing;
  const passwordHash = await hashPassword("demo12345");
  return createUser({
    username: "demo",
    email: "demo@infinite.local",
    passwordHash,
    displayName: "演示用户",
  });
}

async function main() {
  const user = await ensureUser();

  const existing = await pool.query<{ id: string }>(
    `SELECT id FROM worlds WHERE slug = $1 AND deleted_at IS NULL LIMIT 1`,
    [WORLD_SLUG],
  );
  if (existing.rows[0]) {
    const id = existing.rows[0].id;
    await pool.query(`DELETE FROM works WHERE world_id = $1`, [id]);
    await pool.query(`DELETE FROM worlds WHERE id = $1`, [id]);
    console.log("removed previous 神会工造");
  }

  const worldRes = await pool.query<{ id: string }>(
    `INSERT INTO worlds (
       creator_id, name, slug, tagline, description, cover_url, logo_url,
       wiki_background_url, tags, status, visibility, welcome_message,
       homepage_config, world_layout
     ) VALUES ($1, $2, $3, $4, $5, NULL, NULL, NULL, $6, 'published', 'public', $7, $8::jsonb, $9::jsonb)
     RETURNING id`,
    [
      user.id,
      "神会工造",
      WORLD_SLUG,
      "在电池宇宙与神迹之间，原物质指向每一个世界。",
      "由原物质（root）编织的多元宇宙：神会以传输协议殖民，清醒者试图把技术还给所有人，而有人用同一门技术，为一个逝去的人重建了一所大学。",
      ["科幻", "多元宇宙", "悬疑", "反乌托邦", "校园"],
      "欢迎来到神会工造。这里记录神会、清醒者，以及被原物质改写的一切故事。",
      JSON.stringify(HOMEPAGE_CONFIG),
      JSON.stringify(buildDefaultLayout(HOMEPAGE_CONFIG.modules)),
    ],
  );
  const worldId = worldRes.rows[0].id;

  await pool.query(`INSERT INTO world_permissions (world_id) VALUES ($1)`, [
    worldId,
  ]);
  await pool.query(
    `INSERT INTO world_members (world_id, user_id, role) VALUES ($1, $2, 'creator')`,
    [worldId, user.id],
  );
  await pool.query(
    `INSERT INTO world_follows (user_id, world_id) VALUES ($1, $2)
     ON CONFLICT DO NOTHING`,
    [user.id, worldId],
  );

  for (const e of ENTRIES) {
    await pool.query(
      `INSERT INTO wiki_entries (
         world_id, category, title, slug, content, status, created_by, updated_by
       ) VALUES ($1, $2, $3, $4, $5, 'published', $6, $6)`,
      [worldId, e.category, e.title, e.slug, e.content, user.id],
    );
  }

  let order = 0;
  for (const t of TIMELINE) {
    await pool.query(
      `INSERT INTO timeline_events (
         world_id, title, description, event_date, sort_order, created_by
       ) VALUES ($1, $2, $3, $4, $5, $6)`,
      [worldId, t.title, t.description, t.eventDate, order++, user.id],
    );
  }

  let hours = 2;
  for (const w of WORKS) {
    await pool.query(
      `INSERT INTO works (
         world_id, author_id, type, category, kind, title, summary, content,
         status, published_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'published', now() - ($9 || ' hours')::interval)`,
      [
        worldId,
        user.id,
        w.type,
        w.category,
        w.kind,
        w.title,
        w.summary,
        w.content,
        String(hours),
      ],
    );
    hours += 6;
  }

  await pool.end();
  console.log(
    `seeded 神会工造 (${ENTRIES.length} entries, ${TIMELINE.length} events, ${WORKS.length} works)`,
  );
  console.log("view: http://localhost:3000/w/shenhui");
}

main().catch(async (err) => {
  console.error(err);
  await pool.end();
  process.exit(1);
});
