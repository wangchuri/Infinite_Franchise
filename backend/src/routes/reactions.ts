import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import { isKnownReactionType, listActiveReactionTypes } from "../config/reaction-config.js";
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

function parseTarget(query: Record<string, unknown>): {
  targetType: ReactionTargetType;
  targetId: string;
} | null {
  const targetType = asString(query.targetType);
  const targetId = asString(query.targetId);
  if (!targetType || !targetId) return null;
  if (!isReactionTargetType(targetType)) return null;
  return { targetType, targetId };
}

export async function registerReactionRoutes(app: FastifyInstance) {
  /** Active reaction types (icon/label/type) — config synced to DB. */
  app.get("/api/reactions/types", async () => {
    return { types: await listActiveReactionTypes() };
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
    const reactionType = asString(body.reactionType) ?? "";
    if (!isKnownReactionType(reactionType)) {
      return reply.code(400).send({ error: "invalid reactionType" });
    }
    if (!(await assertTargetExists(parsed.targetType, parsed.targetId))) {
      return reply.code(404).send({ error: "target not found" });
    }

    const summary = await toggleReaction({
      userId: user.id,
      ...parsed,
      reactionType,
    });
    return summary;
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
    const reactionType = asString(body.reactionType) ?? "";
    if (!isKnownReactionType(reactionType)) {
      return reply.code(400).send({ error: "invalid reactionType" });
    }

    const summary = await removeReaction({
      userId: user.id,
      ...parsed,
      reactionType,
    });
    return summary;
  });
}
