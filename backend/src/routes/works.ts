import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth-guard.js";
import {
  WORK_TYPES,
  createWork,
  findPublicWorkById,
  getWorkReadPayload,
  listPublicWorks,
  toPublicWork,
  type WorkType,
} from "../works.js";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNullableString(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string") return v;
  return undefined;
}

export async function registerWorkRoutes(app: FastifyInstance) {
  /** Plaza: published works across public worlds. */
  app.get("/api/works", async (req) => {
    const q = req.query as { limit?: string };
    const limit = q.limit ? Number(q.limit) : 40;
    const rows = await listPublicWorks(Number.isFinite(limit) ? limit : 40);
    return { works: rows.map(toPublicWork) };
  });

  /** Reading view: work + chapter nav + wiki annotations. */
  app.get("/api/works/:id/read", async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = await getWorkReadPayload(id);
    if (!payload) {
      return reply.code(404).send({ error: "作品不存在或未公开" });
    }
    return payload;
  });

  app.get("/api/works/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await findPublicWorkById(id);
    if (!row) {
      return reply.code(404).send({ error: "作品不存在或未公开" });
    }
    return { work: toPublicWork(row) };
  });

  /** MVP: world creator can create (and optionally publish) a work. */
  app.post("/api/works", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const worldId = asString(body.worldId);
    const typeRaw = asString(body.type) ?? "story";
    const title = asString(body.title);
    if (!worldId || !title) {
      return reply.code(400).send({ error: "需要 worldId 与 title" });
    }
    if (!WORK_TYPES.includes(typeRaw as WorkType)) {
      return reply.code(400).send({ error: "无效的作品类型" });
    }

    try {
      const row = await createWork({
        worldId,
        authorId: user.id,
        type: typeRaw as WorkType,
        title,
        summary: asNullableString(body.summary),
        content: asNullableString(body.content),
        mediaUrl: asNullableString(body.mediaUrl),
        parentId: asNullableString(body.parentId),
        publish: body.publish === true,
      });
      return reply.code(201).send({ work: toPublicWork(row) });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      const code = e.statusCode ?? 500;
      return reply.code(code).send({ error: e.message || "创建失败" });
    }
  });
}
