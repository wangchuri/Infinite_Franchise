# 数据库设计 · 作品域（用户贡献地基）

> 版本：v0.1  
> 日期：2026-07-09  
> 状态：待审核  
> 相关：[00-overview.md](./00-overview.md) · [01-users.md](./01-users.md) · [02-worlds.md](./02-worlds.md)

---

## 1. 设计目标

作品是 **用户贡献的主载体**（小说、章节、剧情、美术等）。

| 能力 | 落表 |
|------|------|
| 用户发表 / 草稿 / 投稿 | `works` |
| 归属某个世界观 | `works.world_id` |
| 作者是谁 | `works.author_id`（**不**写在 users 里） |
| 广场最新作品流 | `works` 按时间查 |
| 世界入口页「本世界最新」 | `works` + `world_id` |
| 喜欢 / 点赞 | `work_likes`（见 01） |
| 关联 Wiki 词条 | `work_entry_links`（批次 B） |
| 审核 | `works.status` + 可选 `review_queue` |

### 原则

1. **贡献地基 = `works` 行**，用外键挂用户与世界。  
2. **状态机清晰**：`draft` → `pending` → `published` / `rejected`。  
3. **类型可扩展**：`type` 枚举，避免过早拆成多张内容表。  
4. **章节**：用 `parent_id` 挂到长篇 `novel`，不另建表（MVP）。

---

## 2. `works`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `UUID` | PK | |
| `world_id` | `UUID` | FK → worlds，NOT NULL | 所属世界 |
| `author_id` | `UUID` | FK → users，NOT NULL | 作者 |
| `type` | `VARCHAR(32)` | NOT NULL | 见下表 |
| `title` | `VARCHAR(200)` | NOT NULL | |
| `summary` | `VARCHAR(500)` | NULL | 列表摘要；可空则截正文 |
| `content` | `TEXT` | NULL | 文本类正文；美术可空 |
| `media_url` | `TEXT` | NULL | 图片/音视频地址 |
| `status` | `VARCHAR(16)` | NOT NULL，默认 `'draft'` | 见状态机 |
| `parent_id` | `UUID` | FK → works，NULL | 章节所属小说 |
| `reviewed_by` | `UUID` | FK → users，NULL | |
| `reviewed_at` | `TIMESTAMPTZ` | NULL | |
| `reject_reason` | `VARCHAR(500)` | NULL | |
| `published_at` | `TIMESTAMPTZ` | NULL | 首次公开时间；流排序可用 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |
| `deleted_at` | `TIMESTAMPTZ` | NULL | 软删 |

### `type` 枚举

| 值 | 含义 |
|----|------|
| `novel` | 长篇容器（可无正文，靠章节） |
| `chapter` | 章节（应有 `parent_id`） |
| `story` | 独立剧情短篇 |
| `artwork` | 美术 |
| `audio` | 音频 |
| `video` | 视频 |
| `other` | 其他素材 |

```text
CHECK (type IN ('novel','chapter','story','artwork','audio','video','other'))
CHECK (status IN ('draft','pending','published','rejected'))
```

### 状态机

```
draft ──提交──▶ pending ──通过──▶ published
                  │
                  └──驳回──▶ rejected ──可改后再提交──▶ pending
```

- `work_submit_mode = open` 时：可直接 `draft → published`（跳过 pending）。  
- 广场 / 入口页默认只展示 `status = published` 且 `deleted_at IS NULL`。

### 索引（热路径）

```text
INDEX (world_id, status, published_at DESC NULLS LAST)  -- 世界内最新
INDEX (status, published_at DESC NULLS LAST)            -- 广场全站流
INDEX (author_id, created_at DESC)                      -- 「我的作品」
INDEX (parent_id)                                       -- 某小说的章节列表
```

---

## 3. `work_likes`

见 [01-users.md §7](./01-users.md)。要点：

- PK `(user_id, work_id)`  
- **不**在 `users` 或 `works` 里存 likes 数组  
- 计数：MVP `COUNT(*)`；以后可加 `works.like_count`

---

## 4. `work_entry_links`（批次 B）

作品与 Wiki 词条多对多（写作快链、设定对照）。

| 字段 | 类型 | 约束 |
|------|------|------|
| `work_id` | `UUID` | PK，FK → works |
| `entry_id` | `UUID` | PK，FK → wiki_entries |
| `created_at` | `TIMESTAMPTZ` | 默认 `now()` |

```text
PRIMARY KEY (work_id, entry_id)
INDEX (entry_id)   -- 从词条反查引用作品
```

---

## 5. `review_queue`（批次 B，可选）

若希望审核列表统一（作品 + 词条草稿）：

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `UUID` | PK |
| `world_id` | `UUID` | FK |
| `target_type` | `VARCHAR(32)` | `work` / `wiki_entry` |
| `target_id` | `UUID` | 目标行 |
| `submitter_id` | `UUID` | FK → users |
| `status` | `VARCHAR(16)` | `pending` / `approved` / `rejected` |
| `reviewer_id` | `UUID` | NULL |
| `reject_reason` | `VARCHAR(500)` | NULL |
| `created_at` | `TIMESTAMPTZ` | |
| `reviewed_at` | `TIMESTAMPTZ` | NULL |

**批次 A 可只用 `works.status = pending` 做审核列表**，不建本表。

---

## 6. 热路径 SQL

### 广场 · 最新作品（不按世界分区）

```sql
SELECT w.id, w.title, w.type, w.published_at,
       w.world_id, worlds.name AS world_name, worlds.slug AS world_slug,
       w.author_id, users.display_name AS author_name
FROM works w
JOIN worlds ON worlds.id = w.world_id
JOIN users ON users.id = w.author_id
WHERE w.status = 'published'
  AND w.deleted_at IS NULL
  AND worlds.visibility = 'public'
  AND worlds.deleted_at IS NULL
ORDER BY w.published_at DESC
LIMIT 20;
```

### 某用户的作品（贡献主页）

```sql
SELECT * FROM works
WHERE author_id = $1 AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### 本世界入口页作品

```sql
SELECT * FROM works
WHERE world_id = $1 AND status = 'published' AND deleted_at IS NULL
ORDER BY published_at DESC
LIMIT 20;
```

---

## 7. 草案 DDL（节选）

```sql
CREATE TABLE works (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id       UUID NOT NULL REFERENCES worlds(id),
  author_id      UUID NOT NULL REFERENCES users(id),
  type           VARCHAR(32) NOT NULL,
  title          VARCHAR(200) NOT NULL,
  summary        VARCHAR(500),
  content        TEXT,
  media_url      TEXT,
  status         VARCHAR(16) NOT NULL DEFAULT 'draft',
  parent_id      UUID REFERENCES works(id),
  reviewed_by    UUID REFERENCES users(id),
  reviewed_at    TIMESTAMPTZ,
  reject_reason  VARCHAR(500),
  published_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at     TIMESTAMPTZ,
  CHECK (type IN ('novel','chapter','story','artwork','audio','video','other')),
  CHECK (status IN ('draft','pending','published','rejected'))
);

CREATE INDEX works_world_published_idx
  ON works (world_id, status, published_at DESC NULLS LAST);
CREATE INDEX works_feed_idx
  ON works (status, published_at DESC NULLS LAST);
CREATE INDEX works_author_idx
  ON works (author_id, created_at DESC);
CREATE INDEX works_parent_idx ON works (parent_id);

CREATE TABLE work_likes (
  user_id    UUID NOT NULL REFERENCES users(id),
  work_id    UUID NOT NULL REFERENCES works(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, work_id)
);

CREATE INDEX work_likes_work_idx ON work_likes (work_id, created_at DESC);
```

---

## 8. 待拍板

| # | 问题 | 建议 |
|---|------|------|
| 1 | 正文用 Markdown 还是富文本 JSON | MVP **Markdown 存 TEXT** |
| 2 | 媒体是否先本地磁盘 | MVP 可先 `media_url` 字符串，存储后接 |
| 3 | 批次 A 是否含 `work_likes` | **含**（鸿蒙地基） |
| 4 | 批次 A 是否建 `review_queue` | **不建**，用 `works.status` |

---

## 9. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-07-09 | 作品域首版：贡献地基 |
