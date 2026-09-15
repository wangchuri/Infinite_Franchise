# 无限企划 · Infinite Franchise

> 一个以「世界观」为容器的创作与共建平台——人人可浏览、可参与共创，Web 端负责建造与管理，手机端负责发现与阅读（后续）。

每个世界观拥有自己的 Wiki 式主页来沉淀设定，通过共创积累作品；写作时自动关联世界词条，让设定与故事互相反哺，形成可持续生长的 fictional universe 生态。

## 功能特性

> 完整的功能现状见 [`docs/features.md`](docs/features.md)。

- **广场作品流**：最新作品 + 所属世界观，支持搜索过滤
- **世界观 Wiki**：每个世界一套独立 Wiki——**归属系统**（可自定义分类）+ **词条属性** + **区块化布局编辑器**
- **`[[词条]]` 关联**：正文自动链接到世界词条并悬浮展示，写作时输入 `[[` 快速补全
- **共创**：创建世界观 → 编辑词条 → 投稿作品；支持开放 / 审核 / 仅邀请三种投稿策略与成员权限
- **创作工作台**：小说（短篇 / 长篇 / 章节 + 大纲排序）、美术、程序、音频、视频；自动保存 + 本地草稿
- **阅读器**：滚动 / 翻页双模式，阅读进度与位置记忆，字号 / 行距 / 夜间设置，Wiki 词条标注联动
- **社区互动**：多类型反应（内置 + 世界自定义 + 作品当表情）、评论、讨论话题、时间线
- **页面转场**：斜切纸色面板扫过，顶栏三区完整扫过、其余跳转轻过渡，尊重减少动效
- **用户体系**：注册 / 登录 / JWT 会话 / 用户隔离

## 技术栈

| 层 | 技术 | 目录 |
|----|------|------|
| 前端 | Next.js 16 + React 19 + TypeScript + CSS Modules | `frontend/` |
| 后端 | Node.js + TypeScript + Fastify 5 + PostgreSQL（裸 SQL） | `backend/` |
| 文档 | 产品 / 视觉 / 技术选型 | `docs/` |

## 快速开始

### 前置要求

- Node.js ≥ 20
- PostgreSQL（本机或 Docker）

### 后端

```bash
cd backend
npm install
cp .env.example .env        # 填入你的 DATABASE_URL 与 JWT_SECRET
npm run db:ensure           # 自动创建数据库
npm run db:migrate          # 应用迁移
npm run db:seed             # 可选：演示用户（demo / demo12345）
npm run db:seed:works       # 可选：演示作品
npm run dev                 # http://localhost:4000
```

### 前端

```bash
cd frontend
npm install
cp .env.example .env.local  # 默认 API 指向 http://localhost:4000
npm run dev                 # http://localhost:3000
```

### 配置说明（`.env`）

```ini
DATABASE_URL=postgresql://USER:PASSWORD@localhost:5432/infinite_franchise
JWT_SECRET=至少16位的随机字符串
CORS_ORIGIN=http://localhost:3000
STORAGE_DRIVER=local
LOCAL_UPLOAD_DIR=./uploads
PUBLIC_FILE_BASE_URL=http://localhost:4000/files
```

> `ensure-db` 脚本默认使用 `psql`，若不在 PATH 中可通过 `PSQL_BIN` 指定完整路径。

## 仓库结构

```
Infinite_Franchise/
├── backend/          # Node.js + Fastify API
│   ├── migrations/   # SQL 迁移（按序应用）
│   ├── scripts/      # 建库 / 迁移 / 种子数据
│   └── src/
├── frontend/         # Next.js Web 端
├── docs/             # 产品设计 / 视觉规范 / 可行性分析
└── LICENSE
```

## 路线图

见 [`docs/feasibility-analysis.md`](docs/feasibility-analysis.md) 与 [`docs/design.md`](docs/design.md)。

## License

[MIT](LICENSE)
