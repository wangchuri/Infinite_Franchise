import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import { searchUsers } from "../services/users.js";

export async function registerUserRoutes(app: FastifyInstance) {
  /** Search site users by username / display name (for co-author pickers). */
  app.get("/api/users/search", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const q = (req.query as { q?: string }).q?.trim() ?? "";
    if (!q) return { users: [] };

    const limitRaw = (req.query as { limit?: string }).limit;
    const limit = limitRaw ? Number(limitRaw) : 8;
    const users = await searchUsers(
      q.slice(0, 32),
      user.id,
      Number.isFinite(limit) ? Math.min(Math.max(limit, 1), 20) : 8,
    );
    return { users };
  });
}
