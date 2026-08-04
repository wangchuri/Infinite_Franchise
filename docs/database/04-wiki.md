# 数据库设计 · Wiki 域

> 版本：v0.1  
> 日期：2026-07-09  
> 状态：待审核（建议 **批次 B** 建表；字段先定稿）  
> 相关：[00-overview.md](./00-overview.md) · [02-worlds.md](./02-worlds.md) · [03-works.md](./03-works.md)

---

## 1. 设计目标

| 能力 | 落表 |
|------|------|
| 世界介绍 / 人物地点等词条 | `wiki_entries` |
| 词条互链 | `wiki_entry_links` |
| 时间轴 | `timeline_events` |
| 发展史 | `world_history` |
| 写作时链接 / 新概念入库 | `wiki_entries` + `work_entry_links` |
| 版本回滚 | `wiki_entry_versions`（批次 C） |

### 原则

1. **全站共用表 + `world_id` 过滤** =「每个世界自己的 Wiki」。  
2. **版式固定**：不存每世界一套布局 HTML。  
3. **世界介绍**：用 `category = 'intro'` 的特殊词条，或约定 `slug = 'intro'` 唯一一条；本草案用 **category + 每世界一条 intro**。  
4. 与作品解耦：先有词条，再通过链接表关联作品。

---

## 2. `wiki_entries`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `UUID` | PK | |
| `world_id` | `UUID` | FK → worlds，NOT NULL | |
| `category` | `VARCHAR(32)` | NOT NULL | 见下表 |
| `title` | `VARCHAR(120)` | NOT NULL | |
| `slug` | `VARCHAR(120)` | NOT NULL | 世界内 URL；intro 可用 `intro` |
| `aliases` | `TEXT[]` | NOT NULL，默认 `'{}'` | 链接匹配别名；MVP 可用空数组 |
| `content` | `TEXT` | NOT NULL，默认 `''` | Markdown |
| `status` | `VARCHAR(16)` | NOT NULL，默认 `'published'` | `draft` / `pending` / `published` |
| `created_by` | `UUID` | FK → users，NOT NULL | |
| `updated_by` | `UUID` | FK → users，NOT NULL | |
| `version` | `INT` | NOT NULL，默认 `1` | 乐观版本号 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |
| `deleted_at` | `TIMESTAMPTZ` | NULL | |

### `category`

| 值 | 含义 |
|----|------|
| `intro` | 世界介绍（每世界建议仅一条） |
| `character` | 人物 |
| `location` | 地点 |
| `item` | 物品 |
| `organization` | 组织 |
| `event` | 事件 |
| `concept` | 概念（写作新概念入库常用） |
| `other` | 其他 |

```text
UNIQUE (world_id, slug) WHERE deleted_at IS NULL
INDEX (world_id, category, title)
INDEX (world_id, status)
-- 别名搜索以后可用：GIN (aliases)
```

创建世界时可自动插入一条 `category = intro`、`slug = 'intro'` 的空介绍页。

---

## 3. `wiki_entry_links`

| 字段 | 类型 | 约束 |
|------|------|------|
| `from_entry_id` | `UUID` | PK，FK → wiki_entries |
| `to_entry_id` | `UUID` | PK，FK → wiki_entries |
| `created_at` | `TIMESTAMPTZ` | 默认 `now()` |

应用层保证两词条同属一个 `world_id`。

---

## 4. `timeline_events`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `UUID` | PK | |
| `world_id` | `UUID` | FK，NOT NULL | |
| `title` | `VARCHAR(200)` | NOT NULL | |
| `description` | `TEXT` | NOT NULL，默认 `''` | |
| `event_date` | `VARCHAR(64)` | NOT NULL，默认 `''` | 虚构历法文本，如「港务历 47」 |
| `sort_order` | `INT` | NOT NULL，默认 `0` | 排序 |
| `created_by` | `UUID` | FK → users | |
| `created_at` | `TIMESTAMPTZ` | 默认 `now()` | |
| `updated_at` | `TIMESTAMPTZ` | 默认 `now()` | |

关联词条：MVP 可用中间表 `timeline_event_entries (event_id, entry_id)`；若想更简单，首期 **不关联词条**，只存文本。

**本草案：首期时间轴不建关联表**，需要时再加。

```text
INDEX (world_id, sort_order)
```

---

## 5. `world_history`（发展史）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `UUID` | PK |
| `world_id` | `UUID` | FK |
| `title` | `VARCHAR(200)` | |
| `content` | `TEXT` | |
| `occurred_at` | `TIMESTAMPTZ` | 现实时间，可空 |
| `sort_order` | `INT` | |
| `created_by` | `UUID` | FK |
| `created_at` | `TIMESTAMPTZ` | |

与时间轴区别：时间轴偏 **设定内纪年**；发展史偏 **社区/版本里程碑**（可选）。MVP 可只做时间轴，本表批次 B 末或 C。

---

## 6. `wiki_entry_versions`（批次 C）

| 字段 | 类型 | 说明 |
|------|------|------|
| `id` | `UUID` | PK |
| `entry_id` | `UUID` | FK |
| `version` | `INT` | |
| `content` | `TEXT` | |
| `edited_by` | `UUID` | FK |
| `created_at` | `TIMESTAMPTZ` | |

```text
UNIQUE (entry_id, version)
```

---

## 7. 热路径

### Wiki 侧栏词条列表

```sql
SELECT id, category, title, slug
FROM wiki_entries
WHERE world_id = $1 AND status = 'published' AND deleted_at IS NULL
ORDER BY category, title;
```

### 词条详情

```sql
SELECT * FROM wiki_entries
WHERE world_id = $1 AND slug = $2 AND deleted_at IS NULL;
```

### 写作时按标题/别名补全

```sql
SELECT id, title, slug
FROM wiki_entries
WHERE world_id = $1
  AND status = 'published'
  AND deleted_at IS NULL
  AND (
    title ILIKE $2 OR $3 = ANY (aliases)
  )
LIMIT 20;
```

---

## 8. 草案 DDL（节选）

```sql
CREATE TABLE wiki_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id    UUID NOT NULL REFERENCES worlds(id),
  category    VARCHAR(32) NOT NULL,
  title       VARCHAR(120) NOT NULL,
  slug        VARCHAR(120) NOT NULL,
  aliases     TEXT[] NOT NULL DEFAULT '{}',
  content     TEXT NOT NULL DEFAULT '',
  status      VARCHAR(16) NOT NULL DEFAULT 'published',
  created_by  UUID NOT NULL REFERENCES users(id),
  updated_by  UUID NOT NULL REFERENCES users(id),
  version     INT NOT NULL DEFAULT 1,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at  TIMESTAMPTZ,
  CHECK (category IN (
    'intro','character','location','item','organization','event','concept','other'
  )),
  CHECK (status IN ('draft','pending','published'))
);

CREATE UNIQUE INDEX wiki_entries_world_slug_uidx
  ON wiki_entries (world_id, slug) WHERE deleted_at IS NULL;
CREATE INDEX wiki_entries_world_cat_idx
  ON wiki_entries (world_id, category, title);

CREATE TABLE wiki_entry_links (
  from_entry_id UUID NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  to_entry_id   UUID NOT NULL REFERENCES wiki_entries(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (from_entry_id, to_entry_id),
  CHECK (from_entry_id <> to_entry_id)
);

CREATE TABLE timeline_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id     UUID NOT NULL REFERENCES worlds(id),
  title        VARCHAR(200) NOT NULL,
  description  TEXT NOT NULL DEFAULT '',
  event_date   VARCHAR(64) NOT NULL DEFAULT '',
  sort_order   INT NOT NULL DEFAULT 0,
  created_by   UUID REFERENCES users(id),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX timeline_events_world_idx
  ON timeline_events (world_id, sort_order);
```

---

## 9. 待拍板

| # | 问题 | 建议 |
|---|------|------|
| 1 | 世界介绍是否单独表 | **否**，用 `category = intro` |
| 2 | `aliases` 用数组还是子表 | MVP **数组** |
| 3 | 发展史是否进批次 B | **可延后**，先时间轴 |
| 4 | 新概念入库默认草稿还是直接发布 | 跟 `wiki_edit_mode`；默认 **draft/pending** 更安全 |

---

## 10. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-07-09 | Wiki 域首版 |
