import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import { listReactionTypesForWorld } from "../config/reaction-config.js";
import {
  assertTargetExists,
  getReactionSummary,
  isReactionTargetType,
  removeReaction,
  toggleReaction,
  type ReactionTargetType,
} from "../services/reactions.js";

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

export async function registerReactionRoutes(app: FastifyInstance) {
  /**
   * Active reaction types. Global built-ins by default; pass ?worldId= to also
   * include that world's custom reactions.
   */
  app.get("/api/reactions/types", async (req) => {
    const q = (req.query ?? {}) as Record<string, unknown>;
    const worldId = asString(q.worldId) ?? null;
    return { types: await listReactionTypesForWorld(worldId) };
  });

  /** Per-target counts + the current viewer's reactions. */
  app.get("/api/reactions/summary", async (req, reply) => {
    const parsed = parseTarget((req.query ?? {}) as Record<string, unknown>);
    if (!parsed) {
      return reply.code(400).send({
        error: "targetType (work|entry|timeline) and targetId are required",
      });
    }
    const summary = await getReactionSummary(
      parsed.targetType,
      parsed.targetId,
      req.authUser?.id ?? null,
    );
    return summary;
  });

  /** Toggle a reaction on/off (insert or delete by type). */
  app.post("/api/reactions/toggle", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = parseTarget(body);
    if (!parsed) {
      return reply.code(400).send({
        error: "targetType (work|entry|timeline) and targetId are required",
      });
    }
    const reactionTypeId = asString(body.reactionTypeId) ?? "";
    if (!reactionTypeId) {
      return reply.code(400).send({ error: "reactionTypeId is required" });
    }
    if (!(await assertTargetExists(parsed.targetType, parsed.targetId))) {
      return reply.code(404).send({ error: "target not found" });
    }

    try {
      const summary = await toggleReaction({
        userId: user.id,
        ...parsed,
        reactionTypeId,
      });
      return summary;
    } catch (err) {
      const e = err as Error & { statusCode?: number };
      return reply
        .code(e.statusCode ?? 500)
        .send({ error: e.message || "操作失败" });
    }
  });

  /** Explicitly remove a reaction (un-toggle). */
  app.post("/api/reactions/remove", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = parseTarget(body);
    if (!parsed) {
      return reply.code(400).send({
        error: "targetType (work|entry|timeline) and targetId are required",
      });
    }
    const reactionTypeId = asString(body.reactionTypeId) ?? "";
    if (!reactionTypeId) {
      return reply.code(400).send({ error: "reactionTypeId is required" });
    }

    const summary = await removeReaction({
      userId: user.id,
      ...parsed,
      reactionTypeId,
    });
    return summary;
  });
}
