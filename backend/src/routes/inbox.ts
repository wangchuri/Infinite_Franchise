import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import {
  countUnread,
  listNotifications,
  listReceivedInvites,
  markRead,
  respondToInvite,
} from "../services/inbox.js";

export async function registerInboxRoutes(app: FastifyInstance) {
  /** Everything waiting for the current user: invites/requests + notifications. */
  app.get("/api/inbox", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const q = (req.query ?? {}) as { limit?: string };
    const limit = q.limit ? Number(q.limit) : 40;
    const [invites, notifications, unread] = await Promise.all([
      listReceivedInvites(user.id),
      listNotifications(user.id, Number.isFinite(limit) ? limit : 40),
      countUnread(user.id),
    ]);
    return { invites, notifications, unread };
  });

  /** Lightweight badge count for the topbar bell. */
  app.get("/api/inbox/count", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    return { unread: await countUnread(user.id) };
  });

  async function respond(
    req: FastifyRequest,
    reply: FastifyReply,
    accept: boolean,
  ) {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const result = await respondToInvite({
      inviteId: id,
      userId: user.id,
      accept,
    });
    if (!result.ok) {
      const code = result.reason === "forbidden" ? 403 : 404;
      return reply.code(code).send({ error: "邀请不存在或已处理" });
    }
    return { accepted: result.accepted };
  }

  app.post("/api/inbox/invites/:id/accept", (req, reply) =>
    respond(req, reply, true),
  );
  app.post("/api/inbox/invites/:id/decline", (req, reply) =>
    respond(req, reply, false),
  );

  /** Mark notifications read (optionally a subset). */
  app.post("/api/inbox/read", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const body = (req.body ?? {}) as { ids?: unknown };
    const ids = Array.isArray(body.ids)
      ? body.ids.filter((x): x is string => typeof x === "string")
      : undefined;
    await markRead(user.id, ids);
    return { ok: true };
  });
}
