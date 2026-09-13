import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import type { WorkCategory } from "../config/work-taxonomy.js";
import { canReviewWorks, getMemberRole } from "../services/collab.js";
import { findWorldById, type WorldRow } from "../services/worlds.js";
import {
  createWork,
  findAnyWorkById,
  findPublicWorkById,
  getWorkReadPayload,
  listPendingWorks,
  listPublicWorks,
  listPublicWorksByWorld,
  reviewWork,
  toPublicWork,
} from "../services/works.js";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNullableString(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string") return v;
  return undefined;
}

async function loadReviewableWorld(
  worldId: string,
  userId: string,
): Promise<WorldRow | null> {
  const world = await findWorldById(worldId);
  if (!world) return null;
  const role = await getMemberRole(worldId, userId);
  if (!canReviewWorks({ world, role, userId })) return null;
  return world;
}

export async function registerWorkRoutes(app: FastifyInstance) {
  /** Plaza: published works across public worlds. */
  app.get("/api/works", async (req) => {
    const q = req.query as { limit?: string; worldId?: string };
    const limit = q.limit ? Number(q.limit) : 40;
    const safeLimit = Number.isFinite(limit) ? limit : 40;
    const worldId = q.worldId?.trim();
    const rows = worldId
      ? await listPublicWorksByWorld(worldId, safeLimit)
      : await listPublicWorks(safeLimit);
    return { works: rows.map(toPublicWork) };
  });

  /** Pending works awaiting review (creator/editor of the world). */
  app.get("/api/worlds/:id/works/pending", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadReviewableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }
    const rows = await listPendingWorks(id);
    return { works: rows.map(toPublicWork) };
  });

  /** Approve / reject a pending work (creator or editor of its world). */
  app.post("/api/works/:id/review", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { id } = req.params as { id: string };
    const work = await findAnyWorkById(id);
    if (!work || work.status !== "pending") {
      return reply.code(404).send({ error: "待审核作品不存在" });
    }

    const world = await loadReviewableWorld(work.world_id, user.id);
    if (!world) {
      return reply.code(403).send({ error: "无审核权限" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const action = asString(body.action);
    if (action !== "approve" && action !== "reject") {
      return reply.code(400).send({ error: "action must be approve|reject" });
    }

    const updated = await reviewWork({
      workId: id,
      reviewerId: user.id,
      action,
      reason: asString(body.reason),
    });
    return { work: toPublicWork(updated!) };
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
    const categoryRaw = asString(body.category) ?? "other";
    const kindRaw = asString(body.kind) ?? "";
    const title = asString(body.title);
    if (!worldId || !title) {
      return reply.code(400).send({ error: "需要 worldId 与 title" });
    }

    try {
      const row = await createWork({
        worldId,
        authorId: user.id,
        category: categoryRaw as WorkCategory,
        kind: kindRaw,
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
