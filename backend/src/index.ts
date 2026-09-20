import "dotenv/config";
import fs from "node:fs/promises";
import path from "node:path";
import Fastify from "fastify";
import cors from "@fastify/cors";
import fastifyStatic from "@fastify/static";
import { registerAuthPlugin } from "./auth/auth-guard.js";
import { pool, checkDatabase } from "./db.js";
import { syncReactionTypes } from "./config/reaction-config.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerCommentRoutes } from "./routes/comments.js";
import { registerInboxRoutes } from "./routes/inbox.js";
import { registerReactionRoutes } from "./routes/reactions.js";
import { registerTopicRoutes } from "./routes/topics.js";
import { registerUploadRoutes } from "./routes/uploads.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerWorkRoutes } from "./routes/works.js";
import { registerWorldRoutes } from "./routes/worlds.js";
import { getLocalUploadDir } from "./storage/index.js";

const port = Number(process.env.PORT ?? 4000);
const host = process.env.HOST ?? "0.0.0.0";
const corsOrigin = process.env.CORS_ORIGIN ?? "http://localhost:3000";

async function main() {
  const app = Fastify({
    logger: true,
  });

  // Dev: frontend :3000 → API :4000; allow PATCH/DELETE for world editor
  await app.register(cors, {
    origin: corsOrigin,
    methods: ["GET", "HEAD", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization", "Accept"],
    exposedHeaders: ["Content-Type"],
    credentials: true,
    maxAge: 86400,
  });

  const uploadDir = getLocalUploadDir();
  await fs.mkdir(uploadDir, { recursive: true });
  await app.register(fastifyStatic, {
    root: path.resolve(uploadDir),
    prefix: "/files/",
    decorateReply: false,
  });

  await registerAuthPlugin(app);

  // Reaction 类型配置 → 数据库同步（新增类型只改 reaction-config.ts）
  await syncReactionTypes();

  app.get("/", async () => {
    return {
      service: "Infinite Franchise API",
      health: "/health",
      api: "/api",
      auth: {
        register: "POST /api/auth/register",
        login: "POST /api/auth/login",
        me: "GET /api/auth/me",
      },
      worlds: {
        create: "POST /api/worlds",
        mine: "GET /api/worlds/mine",
        bySlug: "GET /api/worlds/:slug",
        publish: "POST /api/worlds/:id/publish",
      },
      works: {
        feed: "GET /api/works",
        detail: "GET /api/works/:id",
        create: "POST /api/works",
      },
      uploads: "POST /api/uploads",
    };
  });

  app.get("/health", async () => {
    const database = await checkDatabase();
    return {
      ok: database.ok,
      service: "infinite-franchise-api",
      time: new Date().toISOString(),
      database,
    };
  });

  app.get("/api", async () => {
    return {
      name: "Infinite Franchise API",
      version: "0.2.0",
      auth: "POST /api/auth/register | POST /api/auth/login | GET /api/auth/me",
      worlds:
        "POST /api/worlds | GET /api/worlds/mine | GET /api/worlds/:slug | PATCH /api/worlds/:id | POST /api/worlds/:id/publish",
      works: "GET /api/works | GET /api/works/:id | POST /api/works",
      entries: "GET|POST /api/worlds/:id/entries | PATCH|DELETE .../entries/:entryId",
      timeline:
        "GET|POST /api/worlds/:id/timeline | PATCH|DELETE .../timeline/:eventId",
      reactions:
        "GET /api/reactions/types | GET /api/reactions/summary | POST /api/reactions/toggle | POST /api/reactions/remove",
      comments:
        "GET /api/comments | POST /api/comments | DELETE /api/comments/:id",
      uploads: "POST /api/uploads",
      isolation:
        "Protected routes use JWT user id from Authorization header; never trust client-sent userId.",
      note: "Email/SMS verification not wired; local password auth only. STORAGE_DRIVER=local.",
    };
  });

  await registerAuthRoutes(app);
  await registerUserRoutes(app);
  await registerUploadRoutes(app);
  await registerWorldRoutes(app);
  await registerWorkRoutes(app);
  await registerReactionRoutes(app);
  await registerCommentRoutes(app);
  await registerTopicRoutes(app);
  await registerInboxRoutes(app);

  app.addHook("onClose", async () => {
    await pool.end();
  });

  await app.listen({ port, host });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
