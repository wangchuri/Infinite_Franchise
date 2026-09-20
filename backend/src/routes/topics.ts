import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import { canReviewWorks, getMemberRole } from "../services/collab.js";
import {
  createTopic,
  findTopicById,
  findTopicRow,
  listTopics,
  setTopicPinned,
  softDeleteTopic,
  updateTopic,
  type TopicSort,
  type TopicStatus,
} from "../services/topics.js";
import {
  canViewWorld,
  findWorldById,
  findWorldBySlug,
  isWorldCreator,
} from "../services/worlds.js";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseStatus(v: unknown): TopicStatus | undefined {
  return v === "open" || v === "resolved" ? v : undefined;
}

function parseSort(v: unknown): TopicSort {
  return v === "hot" ? "hot" : "latest";
}

async function loadViewableWorldBySlug(
  slug: string,
  viewerId: string | null,
) {
  const world = await findWorldBySlug(slug);
  if (!world || !(await canViewWorld(world, viewerId))) return null;
  return world;
}

export async function registerTopicRoutes(app: FastifyInstance) {
  /** Topic list for a world. */
  app.get("/api/worlds/:slug/topics", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const q = (req.query ?? {}) as Record<string, unknown>;
    const world = await loadViewableWorldBySlug(
      slug,
      req.authUser?.id ?? null,
    );
    if (!world) return reply.code(404).send({ error: "world not found" });

    const topics = await listTopics(world.id, {
      status: parseStatus(q.status),
      sort: parseSort(q.sort),
    });
    return { topics };
  });

  /** Create a topic. Public+published worlds: any signed-in user. */
  app.post("/api/worlds/:slug/topics", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { slug } = req.params as { slug: string };
    const world = await findWorldBySlug(slug);
    if (!world || !(await canViewWorld(world, user.id))) {
      return reply.code(404).send({ error: "world not found" });
    }

    const role = await getMemberRole(world.id, user.id);
    const canPost =
      isWorldCreator(world, user.id) ||
      (world.status === "published" && world.visibility === "public") ||
      role != null;
    if (!canPost) {
      return reply.code(403).send({ error: "无权在此世界发起话题" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title)?.trim() ?? "";
    if (!title) {
      return reply.code(400).send({ error: "标题不能为空" });
    }

    const topic = await createTopic({
      worldId: world.id,
      authorId: user.id,
      title,
      body: asString(body.body) ?? "",
    });
    return reply.code(201).send({ topic });
  });

  /** Topic detail. */
  app.get("/api/topics/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const topic = await findTopicById(id);
    if (!topic) return reply.code(404).send({ error: "topic not found" });
    const viewerId = req.authUser?.id ?? null;
    const world = await findWorldById(topic.worldId);
    if (!world || !(await canViewWorld(world, viewerId))) {
      return reply.code(404).send({ error: "topic not found" });
    }
    let canModerate = false;
    if (viewerId) {
      const role = await getMemberRole(topic.worldId, viewerId);
      canModerate = canReviewWorks({ world, role, userId: viewerId });
    }
    return {
      topic,
      isAuthor: viewerId != null && viewerId === topic.authorId,
      canModerate,
    };
  });

  /** Edit title/body (author) or status (author or moderator). */
  app.patch("/api/topics/:id", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { id } = req.params as { id: string };
    const row = await findTopicRow(id);
    if (!row) return reply.code(404).send({ error: "topic not found" });
    const world = await findWorldById(row.world_id);
    if (!world) return reply.code(404).send({ error: "topic not found" });

    const role = await getMemberRole(row.world_id, user.id);
    const isAuthor = row.author_id === user.id;
    const isModerator = canReviewWorks({ world, role, userId: user.id });

    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title);
    const nextBody = body.body === undefined ? undefined : asString(body.body);
    const status = parseStatus(body.status);

    if ((title !== undefined || nextBody !== undefined) && !isAuthor) {
      return reply.code(403).send({ error: "只有作者可以编辑话题" });
    }
    const statusChanged = status !== undefined && status !== row.status;
    if (statusChanged && !(isAuthor || isModerator)) {
      return reply.code(403).send({ error: "无权修改话题状态" });
    }
    if (title !== undefined && !title.trim()) {
      return reply.code(400).send({ error: "标题不能为空" });
    }

    const topic = await updateTopic(id, {
      title,
      body: nextBody,
      status: statusChanged ? status : undefined,
    });
    if (!topic) return reply.code(404).send({ error: "topic not found" });
    return { topic };
  });

  /** Pin / unpin (moderator only). */
  app.post("/api/topics/:id/pin", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { id } = req.params as { id: string };
    const row = await findTopicRow(id);
    if (!row) return reply.code(404).send({ error: "topic not found" });
    const world = await findWorldById(row.world_id);
    if (!world) return reply.code(404).send({ error: "topic not found" });

    const role = await getMemberRole(row.world_id, user.id);
    if (!canReviewWorks({ world, role, userId: user.id })) {
      return reply.code(403).send({ error: "无权置顶话题" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const pinned = body.pinned === true;
    const topic = await setTopicPinned(id, pinned);
    if (!topic) return reply.code(404).send({ error: "topic not found" });
    return { topic };
  });

  /** Soft-delete (author or moderator). */
  app.delete("/api/topics/:id", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const { id } = req.params as { id: string };
    const row = await findTopicRow(id);
    if (!row) return reply.code(404).send({ error: "topic not found" });
    const world = await findWorldById(row.world_id);
    if (!world) return reply.code(404).send({ error: "topic not found" });

    const role = await getMemberRole(row.world_id, user.id);
    const isAuthor = row.author_id === user.id;
    const isModerator = canReviewWorks({ world, role, userId: user.id });
    if (!isAuthor && !isModerator) {
      return reply.code(403).send({ error: "无权删除话题" });
    }

    await softDeleteTopic(id);
    return reply.code(204).send();
  });
}
