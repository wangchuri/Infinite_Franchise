# 技术选型（前后端分离）

> 状态：已确认 · 2026-07-09  
> 原则：Web 优先；鸿蒙为另一前端客户端，后做；业务 API 独立于前端框架。

## 总览

| 层 | 技术 | 目录 |
|----|------|------|
| Web 前端 | **Next.js** + **TypeScript** | `frontend/` |
| 后端 API | **Node.js** + **TypeScript**（Fastify） | `backend/` |
| 数据库 | **PostgreSQL**（已本地接通） | 设计见 [`database/`](./database/) |
| 鸿蒙客户端 | ArkTS（后建工程） | 另建，调同一 API |

## 架构

```
browser  →  frontend (Next.js :3000)  →  backend API (Node :4000)  →  DB
harmony  →  （以后）ArkTS App         ↗
```

- 前端 **只** 负责界面与调用 HTTP API  
- 后端 **只** 负责业务、鉴权、持久化  
- **不** 把正式业务后端做进 Next 的 Route Handlers  

## 本地默认端口

| 服务 | 端口 |
|------|------|
| frontend | `http://localhost:3000` |
| backend  | `http://localhost:4000` |

## 环境要求

- Node.js **20+**（当前环境可用 24）  
- npm 10+（或 pnpm/yarn，团队统一即可）  
- Git  

详见 [`dev-setup.md`](./dev-setup.md)。
