# 无限企划 · 功能现状

> 更新：v0.2 · 2026-09-15  
> 状态：**已进入开发**（前一版 `design.md` 标注的「尚未开发」已过期）  
> 依据：当前代码现状整理。产品愿景与设计原则见 [`design.md`](./design.md)，视觉见 [`visual.md`](./visual.md)，数据表见 [`database/`](./database/)。

---

## 1. 产品定位

**无限企划 / Infinite Franchise** —— 以「世界观」为容器的创作与共建平台。

- 每个世界观拥有**自己的 Wiki 式主页**（不是平台总百科），沉淀设定；
- 围绕世界共创作品（小说 / 美术 / 程序 / 音频 / 视频…）；
- 写作时自动关联世界词条，**设定与故事互相反哺**；
- Web 端负责建造与管理，手机端负责发现与阅读。

**核心闭环**：世界观 → Wiki 词条/时间线 → 共创作品 → 作品内 `[[词条]]` 关联 → 反哺 Wiki 与作品流。

---

## 2. 路由地图（前台）

### 平台层

| 路由 | 作用 |
|------|------|
| `/` | 广场：最新作品流（左栏关注/推荐世界） |
| `/discover` | 发现世界（世界卡片网格） |
| `/create` | 创作入口：我的作品（网格）+ 类型选择 → 工作台 |
| `/create/[type]` | 创作工作台（小说/美术/程序/音频/视频，全宽工具页） |
| `/works/[id]` | 作品阅读页 |
| `/works/[id]/edit` | 作品编辑（同一工作台，编辑模式，自动保存） |
| `/worlds` · `/worlds/new` · `/worlds/[id]/edit` | 我参与/创建的世界、新建世界、世界设置 |
| `/login` · `/register` | 账号 |

### 世界观层

| 路由 | 作用 |
|------|------|
| `/w/[slug]` | 世界主页（Tab：作品 / 话题 / 时间线 / Wiki 入口），保留平台顶栏 |
| `/w/[slug]/wiki` | 世界 Wiki 主页（作者编排的区块布局），**独立无平台 chrome** |
| `/w/[slug]/entry/[entrySlug]` | 公开词条页（含 `?preview=1` 供编辑器预览），独立无 chrome |
| `/w/[slug]/c/[key]` | 归属（分类）词条列表页，独立无 chrome |
| `/w/[slug]/topics/[id]` | 话题详情 |
| `/w/[slug]/discussion` · `/topics` | 301/302 重定向到世界主页话题 Tab |

### 编辑器（全宽工具页）

`/worlds/[id]/wiki`（区块布局编辑器）、`/worlds/[id]/entries`（词条库 + 预览）、`/worlds/[id]/wiki-hub`（Wiki 入口分页）。

---

## 3. 功能模块

### 3.1 账号与权限

- 邮箱/用户名注册、登录、JWT 会话、`GET /api/auth/me`。
- **世界角色**：创建者（creator）/ 编辑（editor）/ 成员；成员由创建者邀请。
- **投稿策略** `workSubmitMode`：
  - `open`：任何人投稿即发布；
  - `review`：进入「待审核」，创建者/编辑审核通过后发布；
  - `invite_only`：仅被邀请成员可投稿。
- **作品可编辑权**：作者本人、世界创建者、编辑（`canEdit`，随阅读数据下发）。

### 3.2 世界观

- 创建/编辑：名称、slug、简介、标签、封面/logo、Wiki 背景、欢迎语。
- **主题与布局**：`homepageConfig`（主题色/字体等）+ `layout`（区块布局，见 3.3）。
- 成员管理（邀请/移除）、反应类型管理、投稿审核。
- 发布/下架（`/publish`）、删除（软删）。
- Fork：**规划中**（尚未实现）。

### 3.3 世界观 Wiki（区块系统）

- **区块布局** `world_layout.blocks`：`topBar / hero / columns / section / divider / spacer / footer`（骨架），
  `nav / navGrid / prose / entryGrid / glossary / timeline / eventAxis / workList / infoBox / stats / tagCloud`（数据区域），
  `platformButton`（平台按钮）、`customHtml`（**沙箱 iframe** 内渲染，注入世界数据）。
- **内容区块**（词条正文与世界页通用）：`heading / text(Markdown) / image / gallery / quote / divider / button / linkList / relatedEntries`。
- **归属系统 `world_collections`**：取代写死的分类；每世界内置 7 类（人物/地点/物品/组织/事件/概念/其他），可新建、改名、图标、隐藏、排序；有词条的内置归属不可删。
- **词条**：标题 / slug / 归属 / 别名 / 属性（按归属的 `attr_fields` 动态表单）/ 封面 / 正文（Markdown 或内容区块）/ 状态 / 版本。
- **词条库 `/worlds/[id]/entries`**：三栏（归属页签 + 词条列表 / 结构列表 + 设备框 iframe 预览 / 属性·组件检查器），支持内联新建归属、拖拽排序、点选联动、自动保存。
- **`[[词条名]]` 引用**：正文里自动 linkify，未知引用保留原文；悬浮卡展示词条信息；也支持 `[[词条名|显示文字]]` 与**别名**匹配。
- **编辑辅助**：Markdown 编辑器输入 `[[` 弹出按归属分组的补全；输入命中词条名时在光标行上方浮出「标记为词条」提示（Tab 采纳）。

### 3.4 作品与创作工作台

- **分类 × 子类型**（`work-taxonomy`，前后端镜像）：
  - 小说：短篇 / 长篇 / 章节
  - 美术：插画 / 漫画 / 设定 / 封面 / 表情
  - 程序：工具 / 互动 / 玩法
  - 音频：音乐 / 配音 / 音效
  - 视频：剪辑 / 动画 / 实录
- **长篇 + 章节**：`parent_id` 结构；`works.position`（迁移 014）保存**章节顺序**。
- **工作台 `/create/[type]` 与 `/works/[id]/edit`**（同一组件）：
  - 顶栏：返回 / 类型 / 行内标题 / 状态（草稿·待审核·已发布）/ 存草稿 / 发布；
  - 稿纸：衬线 Markdown 编辑器（`[[` 补全 + 标记提示）、预览切换、上传文稿（txt/md）、字数；
  - 右栏：封面、归属世界、子类型、简介、**章节大纲**（新建/切换/↑↓ 排序）；
  - **自动保存**：已有作品停笔 1.5s 自动 PATCH；新作品本地草稿备份（`localStorage`），发布后清除。
- **投稿与审核**：`GET /api/worlds/:id/works/pending`、`POST /api/works/:id/review`。
- **美术当表情**：把美术作品设为该世界的反应贴纸（`/api/works/:id/sticker`）。

### 3.5 阅读器 `/works/[id]`

- **滚动 / 翻页**双模式（本地记忆）。
- **阅读设置**：字号 4 档、行距 3 档、夜间主题（本地记忆，CSS 变量驱动）。
- **阅读进度**：顶部 3px 进度条（滚动比例 / 页码），并**记住上次位置**，再次打开自动回到该处。
- **Wiki 注释**侧栏：正文匹配到的本世界词条（关联 / 文中提及），可展开简介。
- **正文联动**：加载世界词条，正文 `[[词条]]` 渲染为链接 + 悬浮卡。
- **信息头**：类型 · 发布日期 · 字数 · 预计阅读时长；作者可见草稿/待审核徽标。
- **媒体**：美术大图 + 点击灯箱；视频 `<video>`、音频 `<audio>`；其他类型为普通封面。
- **章节导航**：上一/下一章为链接（可新标签、走转场），滚动模式 ←/→ 翻章。
- **相关作品**：页底「同世界的其他作品」。
- **右键反应盖章**：正文内右键弹出反应栏，选择后反应从上方坠落、缩入纸面淡出（取消时变灰凋谢）。
- 评论区 + 页底反应栏（与右键盖章计数同步）。

### 3.6 互动

- **反应**：7 个内置（👍点赞 / 🔥棒极了 / ⚠️OOC 警告 / ❤️感动 / 😂乐 / 🧠设定严谨 / 💡有帮助），
  作用域 `global` 与 `world`（世界可自定义）；`kind=emoji | artwork`（作品当表情）；支持 `toggle` 与 `remove`。
- **评论**：按目标（work/entry/timeline/topic）加载、发布、删除。
- **话题**：世界内讨论帖（发布/编辑/置顶/删除）。
- **时间线**：世界事件轴（增删改）。

### 3.7 平台体验

- **广场**：作品流 + 搜索过滤；左栏关注/推荐世界（关注目前仅「创建世界时自动关注」，**尚无关注/取关按钮**）。
- **页面转场**：斜切纸色面板扫过——顶栏三区（广场↔发现世界↔创作）为完整扫过，其余站内跳转为快速铺满 + 交叉淡出；返回上级反向；Wiki 类路由全屏覆盖且 Wiki 内部不播动画；尊重 `prefers-reduced-motion`。
- **平台 chrome 规则**：`/w/[slug]`、`/w/[slug]/discussion` 显示平台顶栏；`/w/[slug]/(wiki|entry|c)`、世界编辑器、创作工作台、作品编辑为独立/全宽。
- **图标**：`frontend/src/app/icon.png`。
- **视觉**：单一 paper 主题（`--ink #14212b` / `--paper #f3efe6` / `--sea #1f5c5a` / `--ember #c45c26`），衬线标题 + 1px 细线 + 强调色竖条。

---

## 4. 数据模型（迁移清单）

| # | 迁移 | 内容 |
|---|------|------|
| 001 | `batch_a` | users / worlds / works 基础 |
| 002 | `batch_b_wiki` | wiki_entries / timeline |
| 003 | `work_entry_links` | 作品↔词条关联 |
| 004 | `reactions` | 反应与类型 |
| 005 | `comments` | 评论 |
| 006 | `world_tagline` | 世界标语 |
| 007 | `world_layout` | 区块布局 |
| 008 | `work_category_kind` | 作品分类/子类型 |
| 009 | `reaction_scope` | 反应作用域（global/world） |
| 010 | `world_topics` | 讨论话题 |
| 011 | `wiki_entry_attributes` | 词条属性 |
| 012 | `world_collections` | 归属系统（替代写死分类） |
| 013 | `entry_content_layout` | 词条正文区块 |
| 014 | `work_position` | 章节排序 |

应用：`cd backend && npm run db:migrate`。

---

## 5. API 概览（按模块）

- **auth**：`POST /api/auth/register`、`POST /api/auth/login`、`GET /api/auth/me`
- **users**：`GET /api/users/search`
- **worlds**：`GET/POST /api/worlds`、`mine`、`following`、`contributable`、`tag-presets`、`/id/:id`、`/:slug`、`PATCH /:id`、`/publish`、`DELETE`
  - 成员：`GET/POST /api/worlds/:id/members`、`DELETE .../:userId`
  - 反应类型：`GET/POST /api/worlds/:id/reaction-types`、`PATCH/DELETE .../:typeId`
  - **归属**：`GET/POST /api/worlds/:id/collections`、`PATCH/DELETE .../:collectionId`
  - **词条**：`GET/POST /api/worlds/:id/entries`、`PATCH/DELETE .../:entryId`
  - 时间线：`GET/POST /api/worlds/:id/timeline`、`PATCH/DELETE .../:eventId`
- **works**：`GET /api/works`、`GET /api/works/mine`、`POST /api/works`、`GET /api/works/:id`、`GET /api/works/:id/read`、`PATCH/DELETE /api/works/:id`
  - 章节：`GET /api/works/:id/chapters`、`PATCH /api/works/:id/chapters/order`
  - 审核：`GET /api/worlds/:id/works/pending`、`POST /api/works/:id/review`
  - 表情：`GET/POST/DELETE /api/works/:id/sticker`
- **reactions**：`GET /api/reactions/types`、`GET /api/reactions/summary`、`POST /api/reactions/toggle`、`POST /api/reactions/remove`
- **comments**：`GET/POST /api/comments`、`DELETE /api/comments/:id`
- **topics**：`GET/POST /api/worlds/:slug/topics`、`GET/PATCH/DELETE /api/topics/:id`、`POST /api/topics/:id/pin`
- **uploads**：图片（jpeg/png/webp/gif）与字体（ttf/otf/woff/woff2），上限 15MB；`STORAGE_DRIVER=local`。

---

## 6. 已实现 vs 规划

**已实现（本文档范围）**：世界观与成员权限、Wiki 归属 + 词条 + 区块编辑器、`[[词条]]` 关联与悬浮卡、公开词条/归属页、作品分类与长篇章节、创作工作台（自动保存 + 章节大纲）、阅读器（进度/设置/标注/灯箱/反应盖章）、反应（内置 + 世界自定义 + 作品当表情）、评论、话题、时间线、投稿审核、页面转场。

**规划中 / 待补**（`feasibility-analysis.md` 为远期路线）：

1. **作品共同作者**：字段已收集未落库；需 `work_authors` 表 + 邀请/同意流程。
2. **通知提醒**：关注世界/作者的作品更新、审核结果、@提醒。
3. **关注/取关按钮**：目前仅创建世界时自动关注。
4. **Fork 世界观**：派生分支与关系标注。
5. **手机端**：发现与阅读（当前仅 Web）。
6. **搜索完善**：站内搜索目前覆盖作品/世界标题。
7. **相关词条自动模式**：按同归属/同属性自动生成。
8. **隐藏归属的公开页 404**。
