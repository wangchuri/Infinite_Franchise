# 数据库设计 · 用户域

> 版本：v0.1  
> 日期：2026-07-09  
> 状态：待审核（见 [00-overview.md](./00-overview.md)）  
> 数据库：PostgreSQL  
> 相关：[`../design.md`](../design.md) §2 角色、§5 广场/关注、§8 原草案

**说明：** 本文含完整用户域（含关注/点赞）。**批次 A 会建这些表**；阅读时可先看 §3 `users`，其余关系表扫一眼即可。
---

## 1. 设计目标

用户域要支撑这些能力，且查询路径清晰：

| 能力 | 主要落表 |
|------|----------|
| 注册 / 登录 / 改密 | `users` |
| 个人资料（昵称、头像、简介） | `users` |
| 会话（Web / 以后鸿蒙多端） | `user_sessions` |
| 关注世界观（广场左侧） | `world_follows` |
| 世界内角色（创建者/编辑/贡献者） | `world_members` |
| 喜欢 / 点赞作品（鸿蒙重点，Web 也可共用） | `work_likes` |
| 账号停用 / 软删除 | `users.status` / `users.deleted_at` |

### 原则

1. **账号与关系分离**：关注、点赞、成员身份用独立表，不塞进 `users` 的 JSON。  
2. **关注 ≠ 成员**：关注只影响信息流；成员才有投稿/编辑权限。  
3. **索引服务热路径**：登录、广场「我关注的世界」、作品点赞数。  
4. **先够用、可扩展**：MVP 不做第三方登录表；预留 `status`、软删字段。  
5. **密码只存哈希**：永不存明文；哈希算法由后端约定（如 Argon2id / bcrypt）。

---

## 2. 实体关系（用户相关）

```
users
  ├── 1:N → user_sessions
  ├── 1:N → world_follows      （关注世界观）
  ├── 1:N → world_members      （某世界内的角色）
  ├── 1:N → work_likes         （喜欢作品）
  ├── 1:N → worlds             （作为 creator 创建的世界，见世界观域）
  └── 1:N → works              （作为 author 的作品，见内容域）
```

---

## 3. `users`（用户账号与资料）

一张表同时承载「登录凭证 + 公开资料」。对当前规模足够；若以后要做复杂认证（多 OAuth），再拆 `user_credentials`。

| 字段 | PostgreSQL 类型 | 约束 | 说明 |
|------|-----------------|------|------|
| `id` | `UUID` | PK，默认 `gen_random_uuid()` | 主键 |
| `username` | `CITEXT` 或 `VARCHAR(32)` | UNIQUE，NOT NULL | 登录名 / @提及；建议小写存储或 CITEXT |
| `email` | `CITEXT` 或 `VARCHAR(255)` | UNIQUE，NOT NULL | 登录与通知 |
| `email_verified_at` | `TIMESTAMPTZ` | NULL | 邮箱验证时间；未验证可为 NULL |
| `password_hash` | `TEXT` | NOT NULL | 密码哈希（含 salt 的算法输出） |
| `display_name` | `VARCHAR(64)` | NOT NULL | 展示名（可与 username 不同） |
| `avatar_url` | `TEXT` | NULL | 头像 URL |
| `bio` | `VARCHAR(500)` | NULL | 简介，限长避免滥用 |
| `status` | `VARCHAR(16)` | NOT NULL，默认 `'active'` | `active` / `disabled` / `banned` |
| `last_login_at` | `TIMESTAMPTZ` | NULL | 最近登录（可选，便于风控） |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | 注册时间 |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | 资料更新时间 |
| `deleted_at` | `TIMESTAMPTZ` | NULL | 软删除；非空则不可登录 |

### 建议约束与索引

```text
UNIQUE (username)          WHERE deleted_at IS NULL   -- 或全局 UNIQUE + 删除时改名
UNIQUE (email)             WHERE deleted_at IS NULL
INDEX  (status)
INDEX  (created_at DESC)
```

### 字段取舍说明

| 做法 | 原因 |
|------|------|
| 分开 `username` 与 `display_name` | 登录标识稳定；展示名可改中文昵称 |
| 用 `status` 而不是删号 | 禁用/封禁可恢复，作品署名仍可指向用户 |
| `bio` 用 `VARCHAR(500)` 而非无限 `TEXT` | 资料卡场景足够，控制存储与展示 |
| 暂不放 `role`（平台管理员） | 平台级 admin 极少；需要时再加 `is_staff` 或独立 `admin_users` |
| 暂不放关注数/获赞数字段 | 用计数表或 `COUNT`/`物化` 后续优化，避免写扩散不一致 |

### 不建议放进 `users` 的

- 关注的世界 ID 列表（→ `world_follows`）  
- 点赞过的作品（→ `work_likes`）  
- 某个世界里的权限（→ `world_members`）  
- 明文密码、支付信息、设备推送 token（后两者另表）

---

## 4. `user_sessions`（登录会话）

支持 Web + 以后鸿蒙多端同时登录、主动登出、踢下线。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `UUID` | PK | 会话 ID（也可作为 refresh 关联） |
| `user_id` | `UUID` | FK → users，NOT NULL | 所属用户 |
| `refresh_token_hash` | `TEXT` | NOT NULL | 只存 refresh token 的哈希 |
| `user_agent` | `TEXT` | NULL | 客户端信息 |
| `ip` | `INET` | NULL | 登录 IP（可选） |
| `expires_at` | `TIMESTAMPTZ` | NOT NULL | 过期时间 |
| `revoked_at` | `TIMESTAMPTZ` | NULL | 主动失效 |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |

```text
INDEX (user_id)
INDEX (expires_at)
UNIQUE (refresh_token_hash)
```

Access Token 用 JWT 即可，**不必**每条请求查库；Refresh 轮换时查/更新本表。

---

## 5. `world_follows`（关注世界观）

对应广场左侧「关注的世界观」、内容流「关注优先」策略。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `user_id` | `UUID` | PK 组成，FK → users | |
| `world_id` | `UUID` | PK 组成，FK → worlds | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | 关注时间 |
| `notify_works` | `BOOLEAN` | NOT NULL，默认 `true` | 是否接收该世界作品更新（预留） |

```text
PRIMARY KEY (user_id, world_id)
INDEX (user_id, created_at DESC)   -- 拉「我关注的列表」
INDEX (world_id)                   -- 统计某世界粉丝数
```

### 与 `world_members` 的区别

| | `world_follows` | `world_members` |
|--|-----------------|-----------------|
| 含义 | 订阅动态 | 社区身份与权限 |
| 广场侧栏 | ✅ | 可选同步显示 |
| 能否投稿 | ❌ 仅关注不够 | 取决于 `role` + 世界权限策略 |
| 创建世界时 | 可自动 follow | 自动写入 `role = creator` |

---

## 6. `world_members`（世界内角色）

沿用产品设计，略作强化，便于权限判断。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `id` | `UUID` | PK | |
| `world_id` | `UUID` | FK → worlds，NOT NULL | |
| `user_id` | `UUID` | FK → users，NOT NULL | |
| `role` | `VARCHAR(32)` | NOT NULL | `creator` / `editor` / `contributor` / `viewer` |
| `joined_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |
| `updated_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | 角色变更时间 |

```text
UNIQUE (world_id, user_id)
INDEX (user_id)                    -- 「我加入的世界」
INDEX (world_id, role)             -- 按角色列成员
```

> 每个世界应有且建议仅有一名 `creator`（可用部分唯一索引或应用层保证）。创建者转让时更新本行，不必改 `worlds.creator_id` 与成员表两套真相——**推荐以 `world_members.role = creator` 为准，或 `worlds.creator_id` 与成员表事务内双写**。MVP 建议：**`worlds.creator_id` + 成员表同步写入 creator**，查询权限优先查 `world_members`。

---

## 7. `work_likes`（喜欢 / 点赞）

鸿蒙端核心互动之一；Web 共用同一表。

| 字段 | 类型 | 约束 | 说明 |
|------|------|------|------|
| `user_id` | `UUID` | PK 组成，FK → users | |
| `work_id` | `UUID` | PK 组成，FK → works | |
| `created_at` | `TIMESTAMPTZ` | NOT NULL，默认 `now()` | |

```text
PRIMARY KEY (user_id, work_id)
INDEX (work_id, created_at DESC)   -- 作品点赞列表 / 计数
INDEX (user_id, created_at DESC)   -- 「我喜欢的」
```

点赞数：MVP 用 `COUNT(*)`；量上来后再加 `works.like_count` 缓存字段 + 触发器/应用层维护。

---

## 8. 热路径查询（验证设计是否高效）

### 8.1 登录

```sql
SELECT id, password_hash, status, deleted_at
FROM users
WHERE email = $1 OR username = $1
LIMIT 1;
```

依赖：`email` / `username` 唯一索引。

### 8.2 广场左侧 · 关注的世界观

```sql
SELECT w.*
FROM world_follows f
JOIN worlds w ON w.id = f.world_id
WHERE f.user_id = $1
ORDER BY f.created_at DESC;
```

依赖：`(user_id, created_at DESC)`。

### 8.3 内容流 · 关注世界的最新作品（可选策略）

```sql
SELECT wk.*
FROM works wk
WHERE wk.status = 'published'
  AND wk.world_id IN (SELECT world_id FROM world_follows WHERE user_id = $1)
ORDER BY wk.created_at DESC
LIMIT 20;
```

依赖：`works (status, world_id, created_at DESC)`（内容域建表时补）。

### 8.4 是否已点赞

```sql
SELECT 1 FROM work_likes WHERE user_id = $1 AND work_id = $2;
```

主键即可。

### 8.5 某世界权限

```sql
SELECT role FROM world_members
WHERE world_id = $1 AND user_id = $2;
```

---

## 9. MVP 建表范围（建议）

与 [00-overview.md](./00-overview.md) **批次 A** 对齐：

1. `users`  
2. `user_sessions`  
3. `world_follows`（依赖 `worlds`，同批迁移）  
4. `world_members`（依赖 `worlds`，同批迁移）  
5. `work_likes`（依赖 `works`，同批迁移）  

**暂缓：** OAuth、用户关注用户、通知、`users` 上统计冗余字段。

---

## 10. 草案 DDL（PostgreSQL）

> 仅设计参考；正式迁移用 Prisma/Drizzle 生成亦可。需启用 pgcrypto/uuid：

```sql
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

CREATE TABLE users (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username           VARCHAR(32)  NOT NULL,
  email              VARCHAR(255) NOT NULL,
  email_verified_at  TIMESTAMPTZ,
  password_hash      TEXT         NOT NULL,
  display_name       VARCHAR(64)  NOT NULL,
  avatar_url         TEXT,
  bio                VARCHAR(500),
  status             VARCHAR(16)  NOT NULL DEFAULT 'active'
                     CHECK (status IN ('active', 'disabled', 'banned')),
  last_login_at      TIMESTAMPTZ,
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
  deleted_at         TIMESTAMPTZ
);

CREATE UNIQUE INDEX users_username_active_uidx
  ON users (lower(username)) WHERE deleted_at IS NULL;
CREATE UNIQUE INDEX users_email_active_uidx
  ON users (lower(email)) WHERE deleted_at IS NULL;
CREATE INDEX users_status_idx ON users (status);

CREATE TABLE user_sessions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id),
  refresh_token_hash  TEXT NOT NULL,
  user_agent          TEXT,
  ip                  INET,
  expires_at          TIMESTAMPTZ NOT NULL,
  revoked_at          TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX user_sessions_token_uidx ON user_sessions (refresh_token_hash);
CREATE INDEX user_sessions_user_idx ON user_sessions (user_id);
CREATE INDEX user_sessions_expires_idx ON user_sessions (expires_at);

-- 以下在 worlds / works 创建之后执行（同一次批次 A 迁移内按依赖排序）

CREATE TABLE world_follows (
  user_id       UUID NOT NULL REFERENCES users(id),
  world_id      UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  notify_works  BOOLEAN NOT NULL DEFAULT true,
  PRIMARY KEY (user_id, world_id)
);
CREATE INDEX world_follows_user_idx ON world_follows (user_id, created_at DESC);
CREATE INDEX world_follows_world_idx ON world_follows (world_id);

CREATE TABLE world_members (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  world_id   UUID NOT NULL REFERENCES worlds(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id),
  role       VARCHAR(32) NOT NULL
             CHECK (role IN ('creator', 'editor', 'contributor', 'viewer')),
  joined_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (world_id, user_id)
);
CREATE INDEX world_members_user_idx ON world_members (user_id);
CREATE INDEX world_members_world_role_idx ON world_members (world_id, role);

-- work_likes 见 03-works.md
```

---

## 11. 待你拍板

| # | 问题 | 建议默认 |
|---|------|----------|
| 1 | 登录标识：仅邮箱 / 仅用户名 / 两者皆可 | **两者皆可** |
| 2 | 用户名规则 | 3–32 位，字母数字下划线 |
| 3 | 未验证邮箱能否发帖 | MVP **允许**，后续再强制验证 |
| 4 | 软删后 username/email 是否释放 | **释放**（部分唯一索引） |
| 5 | 点赞是否可取消 | **可以**（删 `work_likes` 行） |

---

## 12. 修订记录

| 版本 | 日期 | 说明 |
|------|------|------|
| v0.1 | 2026-07-09 | 用户域首版：users / sessions / follows / members / likes |
