# 数据库设计 · 总览

> 版本：v0.2  
> 日期：2026-07-09  
> 状态：**已审核通过** · 批次 A 已迁移建表（`backend/migrations/001_batch_a.sql`）  
> 数据库：单一业务库 `infinite_franchise`（不是「一个世界一个库」）  
> 范式：以 **3NF** 为主；统计字段允许以后反范式缓存  

**实现备注：** 当前注册/登录为本地密码（mock），`email_verified_at` 可空；邮箱/手机验证服务后续再接。

---

## 1. 一句话模型

```
一个 PostgreSQL 库
 └── 固定若干张表
      · users / worlds / works / wiki_entries …
      · 新建用户、世界、作品 = 在对应表里 INSERT 一行
      · 用外键（如 world_id、author_id）表达归属
```

- **用户表不存作品 id 列表**；作品表存 `author_id`。  
- **Wiki 界面按世界过滤**；全站共用 `wiki_entries` 等表，不是每世界一张 Wiki 表。  
- **Wiki 版式可全站固定**；表只存内容与结构数据。

---

## 2. 文档索引


| 文档                             | 内容                 |
| ------------------------------ | ------------------ |
| [01-users.md](./01-users.md)   | 用户、会话、关注、成员、点赞     |
| [02-worlds.md](./02-worlds.md) | 世界观、权限策略           |
| [03-works.md](./03-works.md)   | 作品（用户贡献地基）         |
| [04-wiki.md](./04-wiki.md)     | Wiki 词条、时间轴、发展史、互链 |


---



## 3. 总 ER（概念）

```
users ──┬──< user_sessions
        ├──< world_follows >── worlds
        ├──< world_members >── worlds
        ├──< worlds          （creator_id）
        ├──< works           （author_id）
        ├──< work_likes >──── works
        └──< wiki_entries    （created_by / updated_by）

worlds ──┬──< works
         ├──< wiki_entries
         ├──< timeline_events
         ├──< world_history
         ├──  world_permissions（1:1）
         └──  parent_world_id → worlds（Fork，可空）

works ───< work_entry_links >── wiki_entries
wiki_entries ──< wiki_entry_links >── wiki_entries
```

---



## 4. 建表批次（审核用）



### 批次 A · MVP 地基（审核通过后第一批迁移）


| 表                   | 作用                       |
| ------------------- | ------------------------ |
| `users`             | 注册登录、资料                  |
| `user_sessions`     | 登录会话（Web / 以后鸿蒙）         |
| `worlds`            | 世界观档案                    |
| `world_permissions` | 投稿/Wiki 规则（可与 worlds 同批） |
| `world_members`     | 创建时写入 creator            |
| `world_follows`     | 创建/关注时写入；广场侧栏            |
| `works`             | 用户贡献物；广场作品流              |
| `work_likes`        | 喜欢/点赞（鸿蒙也用）              |


**批次 A 能支撑：** 注册登录、创建/浏览世界、入口页、作品投稿与列表、关注、点赞。

### 批次 B · Wiki 与写作联动（紧随其后）


| 表                  | 作用                     |
| ------------------ | ---------------------- |
| `wiki_entries`     | 词条                     |
| `wiki_entry_links` | 词条互链                   |
| `work_entry_links` | 作品 ↔ 词条                |
| `timeline_events`  | 时间轴                    |
| `world_history`    | 发展史                    |
| `review_queue`     | 审核队列（若不用 works 状态字段硬扛） |




### 批次 C · 增强（可更晚）


| 表 / 字段                 | 作用       |
| ---------------------- | -------- |
| `wiki_entry_versions`  | 词条历史     |
| `works.like_count` 等缓存 | 反范式计数    |
| OAuth / 通知表            | 第三方登录、消息 |


---



## 5. 审核清单（请勾选）

- [x] 同意：**单库多表**，新建世界 = `worlds` 增一行  
- [x] 同意：用户表 **不存** 作品 id；贡献落在 `works.author_id`  
- [x] 同意：关注（`world_follows`）≠ 成员权限（`world_members`）  
- [x] 同意：批次 A 表集合作为第一期建表范围  
- [x] 同意：Wiki 固定版式；批次 B 再建词条相关表  
- [x] 登录：邮箱与用户名 **均可**（见 01 §11，可改）  
- [x] 点赞：**可取消**（删 `work_likes` 行）  
- [x] 2026-07-09 审核通过；批次 A 已迁移；认证为本地密码 mock（邮箱/手机后续再接）  

有异议直接改文档或回复要改哪几条。

---



## 6. 修订记录


| 版本   | 日期         | 说明              |
| ---- | ---------- | --------------- |
| v0.2 | 2026-07-09 | 总览 + 分域文档齐套，供审核 |


