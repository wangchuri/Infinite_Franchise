# 数据库设计 · 世界观域

> 版本：v0.1  
> 日期：2026-07-09  
> 状态：待审核  
> 相关：[00-overview.md](./00-overview.md) · [01-users.md](./01-users.md)

---

## 1. 设计目标

| 能力 | 落表 |
|------|------|
| 创建 / 编辑世界观档案 | `worlds` |
| 入口页欢迎词、封面、简介 | `worlds` |
| 公开 / 私密、是否允许 Fork | `worlds` |
| 投稿与 Wiki 编辑规则 | `world_permissions` |
| Fork 来源 | `worlds.parent_world_id` |
| 关注与成员 | 见用户域 `world_follows` / `world_members` |

### 原则

1. **一行一个世界**；不新建库、不新建「每世界一张表」。  
2. **内容外置**：作品、词条用 `world_id` 挂到本表。  
3. **Wiki 样式可配置、版式由平台渲染**：不存整页自定义 CSS；创建者通过 `homepage_config` 选主题 / 布局 / 模块，前端渲染器负责呈现。  
4. **权限策略独立一行**：避免 `worlds` 过宽，且方便以后扩展规则字段。

---

## 2. `worlds`

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `UUID` | PK，默认 `gen_random_uuid()` | |
| `creator_id` | `UUID` | FK → users，NOT NULL | 创建者；与 members 中 creator 双写 |
| `parent_world_id` | `UUID` | FK → worlds，NULL | Fork 来源；原创为 NULL |
| `name` | `VARCHAR(80)` | NOT NULL | 展示名 |
| `slug` | `VARCHAR(80)` | UNIQUE，NOT NULL | URL 段，如 `yin-gui-ji-yuan` |
| `description` | `VARCHAR(500)` | NOT NULL，默认 `''` | 列表/卡片简介 |
| `cover_url` | `TEXT` | NULL | 封面 |
| `welcome_message` | `TEXT` | NULL | 入口页欢迎词 |
| `visibility` | `VARCHAR(16)` | NOT NULL，默认 `'public'` | `public` / `private` |
| `allow_fork` | `BOOLEAN` | NOT NULL，默认 `true` | |
| `homepage_config` | `JSONB` | NOT NULL，默认 `'{}'` | Wiki 样式：theme / layout / modules / accent / heroStyle 等 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |
| `deleted_at` | `TIMESTAMPTZ` | NULL | 软删 |

### 标签怎么存

**MVP 建议：** 暂不建 `tags` 表；需要筛选时再加 `world_tags`。  
若必须首期带标签：可用 `tags TEXT[]`（PostgreSQL 数组），接受轻微非 3NF 换简单；审核时可二选一。

**本草案默认：首期无 tags 字段**，减少争议；推荐流先按时间/关注。

### 索引

```text
UNIQUE (slug) WHERE deleted_at IS NULL
INDEX (creator_id)
INDEX (visibility, created_at DESC)     -- 公开世界列表
INDEX (parent_world_id)                 -- Fork 列表
INDEX (updated_at DESC)                 -- 最近活跃
```

### 创建世界时的事务（应用层）

1. `INSERT worlds`  
2. `INSERT world_permissions`（默认策略）  
3. `INSERT world_members (role = creator)`  
4. `INSERT world_follows`（创建者自动关注自己的世界）  

---

## 3. `world_permissions`

每个世界一行。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `world_id` | `UUID` | PK，FK → worlds | |
| `work_submit_mode` | `VARCHAR(32)` | NOT NULL，默认 `'review'` | `open` / `review` / `invite_only` |
| `wiki_edit_mode` | `VARCHAR(32)` | NOT NULL，默认 `'editors'` | `creator_only` / `editors` / `all_members` / `draft_only` |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |

```text
CHECK (work_submit_mode IN ('open', 'review', 'invite_only'))
CHECK (wiki_edit_mode IN ('creator_only', 'editors', 'all_members', 'draft_only'))
```

---

## 4. 与用户域表的配合

| 表 | 文档 | 作用 |
|----|------|------|
| `world_follows` | 01-users | 广场左侧关注列表 |
| `world_members` | 01-users | 投稿/编辑权限 |

查询「我能否在此世界投稿」：

1. 读 `world_permissions.work_submit_mode`  
2. 读 `world_members.role`（若需要）  
3. 综合判断（应用层）

---

## 5. 热路径

### 公开世界列表 / 推荐区

```sql
SELECT id, name, slug, description, cover_url, updated_at
FROM worlds
WHERE visibility = 'public' AND deleted_at IS NULL
ORDER BY updated_at DESC
LIMIT 20;
```

### 入口页

```sql
SELECT * FROM worlds WHERE slug = $1 AND deleted_at IS NULL;
SELECT * FROM world_permissions WHERE world_id = $id;
```

### Fork

```sql
INSERT INTO worlds (..., parent_world_id) VALUES (..., $source_world_id);
-- 再复制权限默认值；Wiki 快照复制属批次 B/C 策略
```

---

## 6. 草案 DDL（节选）

```sql
CREATE TABLE worlds (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  creator_id       UUID NOT NULL REFERENCES users(id),
  parent_world_id  UUID REFERENCES worlds(id),
  name             VARCHAR(80) NOT NULL,
  slug             VARCHAR(80) NOT NULL,
  description      VARCHAR(500) NOT NULL DEFAULT '',
  cover_url        TEXT,
  welcome_message  TEXT,
  visibility       VARCHAR(16) NOT NULL DEFAULT 'public'
                   CHECK (visibility IN ('public', 'private')),
  allow_fork       BOOLEAN NOT NULL DEFAULT true,
  homepage_config  JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  deleted_at       TIMESTAMPTZ
);

CREATE UNIQUE INDEX worlds_slug_active_uidx
  ON worlds (slug) WHERE deleted_at IS NULL;
CREATE INDEX worlds_creator_idx ON worlds (creator_id);
CREATE INDEX worlds_public_updated_idx
  ON worlds (visibility, updated_at DESC);

CREATE TABLE world_permissions (
  world_id          UUID PRIMARY KEY REFERENCES worlds(id) ON DELETE CASCADE,
  work_submit_mode  VARCHAR(32) NOT NULL DEFAULT 'review'
                    CHECK (work_submit_mode IN ('open', 'review', 'invite_only')),
  wiki_edit_mode    VARCHAR(32) NOT NULL DEFAULT 'editors'
                    CHECK (wiki_edit_mode IN (
                      'creator_only', 'editors', 'all_members', 'draft_only'
                    )),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

`world_follows` / `world_members` DDL 见 [01-users.md](./01-users.md)（在 `worlds` 存在后创建）。

---

## 7. 待拍板

| # | 问题 | 建议 |
|---|------|------|
| 1 | 首期是否要 tags | **不要**，第二期再加 |
| 2 | `homepage_config` 首期 | **启用**：theme / layout / modules / accent / heroStyle；空 `{}` 走默认 |
| 3 | 私密世界是否进 MVP | **可不进**；字段先留着，API 先只做 public |
| 4 | Fork 是否进批次 A | **字段预留**；复制 Wiki 逻辑放批次 B/C |

---

## 8. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-07-09 | 世界观域首版 |
