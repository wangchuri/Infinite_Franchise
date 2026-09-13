# Infinite Franchise · Backend

Node.js + TypeScript API（Fastify + PostgreSQL）。前后端分离，不承载页面。

## 目录结构

```text
src/
  index.ts          服务装配与启动
  db.ts             连接池 / 事务
  config/           平台配置 schema（homepage-config · world-layout · reaction-config）
  auth/             鉴权（auth · auth-guard）
  services/         业务逻辑（worlds · wiki · works · users · collab · comments · reactions）
  routes/           各资源 HTTP 路由
  storage/          文件存储驱动（local）
```

- `config/` 下与前端 `frontend/src/lib/` 的同名文件互为镜像（`homepage-config.ts`、`world-layout.ts`），改动需两边同步。

## Scripts

```bash
npm install
cp .env.example .env   # 填写 DATABASE_URL 与 JWT_SECRET
npm run db:migrate     # 批次 A 建表
npm run db:seed        # 本地 mock 用户（可选）
npm run dev            # http://localhost:4000
npm run build
npm start
npm run typecheck
npm run db:ensure      # 若库不存在则创建 infinite_franchise
```

## Environment

在 `.env` 中配置（勿提交、勿发到聊天）：

```env
DATABASE_URL=postgresql://postgres:YOUR_PASSWORD@localhost:5432/infinite_franchise
JWT_SECRET=dev-change-me-to-a-long-random-string
```

## Auth（当前：本地密码，无邮箱/手机验证）

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/auth/register` | 注册 `{ username, email, password, displayName? }` |
| POST | `/api/auth/login` | 登录 `{ login, password }`（login 可为邮箱或用户名） |
| GET | `/api/auth/me` | 当前用户（`Authorization: Bearer <accessToken>`） |

### 用户隔离

- 受保护接口通过 JWT 解析出 **服务端可信的 `userId`**（`requireAuth` / `req.authUser`）
- **禁止**信任请求体里的 `userId` 来读写他人数据
- 后续「我的世界 / 我的作品」查询必须带 `WHERE creator_id / author_id = authUser.id`

前端页面：`http://localhost:3000/login` · `/register`

Mock 用户（`npm run db:seed`）：

- `demo` / `demo12345`
- `night_pilot` / `demo12345`

后续可再接邮箱验证码或手机号注册，表结构已预留 `email_verified_at`。

## Other endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/health` | 存活检查，含数据库连通状态 |
| GET | `/api` | API 元信息 |
