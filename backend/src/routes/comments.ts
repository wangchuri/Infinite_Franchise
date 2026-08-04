import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth-guard.js";
import {
  createComment,
  deleteComment,
  listComments,
} from "../comments.js";
import {
  assertTargetExists,
  isReactionTargetType,
  type ReactionTargetType,
} from "../reactions.js";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function parseTarget(source: Record<string, unknown>): {
  targetType: ReactionTargetType;
  targetId: string;
} | null {
  const targetType = asString(source.targetType);
  const targetId = asString(source.targetId);
  if (!targetType || !targetId) return null;
  if (!isReactionTargetType(targetType)) return null;
  return { targetType, targetId };
}

export async function registerCommentRoutes(app: FastifyInstance) {
  /** Comments for a target (works / wiki entries / timeline events). */
  app.get("/api/comments", async (req, reply) => {
    const parsed = parseTarget((req.query ?? {}) as Record<string, unknown>);
    if (!parsed) {
      return reply.code(400).send({
        error: "targetType (work|entry|timeline) and targetId are required",
      });
    }
    const comments = await listComments(parsed.targetType, parsed.targetId);
    return { comments };
  });

  app.post("/api/comments", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = parseTarget(body);
    if (!parsed) {
      return reply.code(400).send({
        error: "targetType (work|entry|timeline) and targetId are required",
      });
    }
    if (!(await assertTargetExists(parsed.targetType, parsed.targetId))) {
      return reply.code(404).send({ error: "target not found" });
    }

    try {
      const comment = await createComment({
        userId: user.id,
        ...parsed,
        content: asString(body.content) ?? "",
      });
      return reply.code(201).send({ comment });
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply
        .code(e.statusCode ?? 500)
        .send({ error: e.message || "评论失败" });
    }
  });

  /** Delete own comment (soft delete). */
  app.delete("/api/comments/:id", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const result = await deleteComment(id, user.id);
    if (result !== "deleted") {
      return reply.code(404).send({ error: "comment not found" });
    }
    return reply.code(204).send();
  });
}
