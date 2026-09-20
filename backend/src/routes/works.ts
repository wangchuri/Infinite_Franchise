import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import type { WorkCategory } from "../config/work-taxonomy.js";
import { canReviewWorks, getMemberRole } from "../services/collab.js";
import { createNotification, notifyWorldReviewers } from "../services/inbox.js";
import { findWorldById, type WorldRow } from "../services/worlds.js";
import {
  canEditWork,
  createWork,
  findAnyWorkById,
  findWorkForViewer,
  getWorkReadPayload,
  listMyWorks,
  listPendingWorks,
  listPublicWorks,
  listPublicWorksByWorld,
  listWorkChapters,
  reorderWorkChapters,
  reviewWork,
  softDeleteWork,
  toPublicWork,
  updateWork,
} from "../services/works.js";
import {
  getWorkSticker,
  removeWorkSticker,
  setWorkSticker,
} from "../services/stickers.js";

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

  /** Current user's works across worlds (draft / pending / published). */
  app.get("/api/works/mine", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const q = req.query as { limit?: string };
    const limit = q.limit ? Number(q.limit) : 60;
    const rows = await listMyWorks(user.id, Number.isFinite(limit) ? limit : 60);
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
    if (updated && updated.author_id !== user.id) {
      await createNotification({
        userId: updated.author_id,
        type: action === "approve" ? "work_approved" : "work_rejected",
        actorId: user.id,
        worldId: updated.world_id,
        workId: updated.id,
        payload: {
          title: updated.title,
          reason: action === "reject" ? asString(body.reason) ?? null : null,
        },
      });
    }
    return { work: toPublicWork(updated!) };
  });

  /** Reading view: work + chapter nav + wiki annotations. */
  app.get("/api/works/:id/read", async (req, reply) => {
    const { id } = req.params as { id: string };
    const payload = await getWorkReadPayload(id, req.authUser?.id ?? null);
    if (!payload) {
      return reply.code(404).send({ error: "作品不存在或未公开" });
    }
    return payload;
  });

  /** Whether an artwork is used as a sticker (and if the viewer may manage it). */
  app.get("/api/works/:id/sticker", async (req, reply) => {
    const { id } = req.params as { id: string };
    const info = await getWorkSticker(id, req.authUser?.id ?? null);
    return info;
  });

  /** Promote an artwork to a sticker (any signed-in user). */
  app.post("/api/works/:id/sticker", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    try {
      const sticker = await setWorkSticker(id, user.id);
      return reply.code(201).send({ sticker });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply
        .code(e.statusCode ?? 500)
        .send({ error: e.message || "操作失败" });
    }
  });

  /** Remove a sticker (artwork author / world owner / editor). */
  app.delete("/api/works/:id/sticker", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    try {
      await removeWorkSticker(id, user.id);
      return reply.code(204).send();
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply
        .code(e.statusCode ?? 500)
        .send({ error: e.message || "操作失败" });
    }
  });

  app.get("/api/works/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await findWorkForViewer(id, req.authUser?.id ?? null);
    if (!row) {
      return reply.code(404).send({ error: "作品不存在或未公开" });
    }
    return { work: toPublicWork(row) };
  });

  /** Chapters of a novel (drafts included for its editors). */
  app.get("/api/works/:id/chapters", async (req, reply) => {
    const { id } = req.params as { id: string };
    const work = await findAnyWorkById(id);
    if (!work || work.deleted_at) {
      return reply.code(404).send({ error: "作品不存在" });
    }
    const canManage = req.authUser
      ? await canEditWork(work, req.authUser.id)
      : false;
    const rows = await listWorkChapters(id, canManage);
    return { chapters: rows.map(toPublicWork) };
  });

  /** Reorder a novel's chapters (author / world creator / editor). */
  app.patch("/api/works/:id/chapters/order", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const novel = await findAnyWorkById(id);
    if (!novel || novel.deleted_at) {
      return reply.code(404).send({ error: "作品不存在" });
    }
    if (!(await canEditWork(novel, user.id))) {
      return reply.code(403).send({ error: "无权调整章节顺序" });
    }
    const body = (req.body ?? {}) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string")
      : [];
    await reorderWorkChapters(id, ids);
    return { ok: true };
  });

  /** Edit a work (author / world creator / editor). */
  app.patch("/api/works/:id", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const body = (req.body ?? {}) as Record<string, unknown>;

    const patch: Parameters<typeof updateWork>[0]["patch"] = {};
    const category = asString(body.category);
    if (category !== undefined) patch.category = category as WorkCategory;
    const kind = asString(body.kind);
    if (kind !== undefined) patch.kind = kind;
    if (body.title !== undefined) patch.title = asString(body.title) ?? "";
    if (body.summary !== undefined) {
      patch.summary = asNullableString(body.summary) ?? null;
    }
    if (body.content !== undefined) {
      patch.content = asNullableString(body.content) ?? null;
    }
    if (body.mediaUrl !== undefined) {
      patch.mediaUrl = asNullableString(body.mediaUrl) ?? null;
    }
    if (body.status === "draft" || body.status === "published") {
      patch.status = body.status;
    }

    try {
      const updated = await updateWork({
        workId: id,
        editorId: user.id,
        patch,
      });
      if (!updated) return reply.code(404).send({ error: "作品不存在" });
      return { work: toPublicWork(updated) };
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply
        .code(e.statusCode ?? 500)
        .send({ error: e.message || "更新失败" });
    }
  });

  /** Soft-delete a work (author / world creator / editor). */
  app.delete("/api/works/:id", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const work = await findAnyWorkById(id);
    if (!work || work.deleted_at) {
      return reply.code(404).send({ error: "作品不存在" });
    }
    if (!(await canEditWork(work, user.id))) {
      return reply.code(403).send({ error: "无权删除该作品" });
    }
    await softDeleteWork(id);
    return reply.code(204).send();
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
      if (row.status === "pending") {
        await notifyWorldReviewers({
          worldId: row.world_id,
          actorId: user.id,
          type: "work_pending",
          workId: row.id,
          payload: { title: row.title },
        });
      }
      return reply.code(201).send({ work: toPublicWork(row) });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      const code = e.statusCode ?? 500;
      return reply.code(code).send({ error: e.message || "创建失败" });
    }
  });
}
