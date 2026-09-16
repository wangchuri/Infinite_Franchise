import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import {
  findUserByUsername,
  followUser,
  getUserProfileStats,
  isFollowing,
  searchUsers,
  toUserProfile,
  unfollowUser,
} from "../services/users.js";
import { listPublicWorksByAuthor, toPublicWork } from "../services/works.js";

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

  /** Public profile: user info + published works + follow state. */
  app.get("/api/users/:username", async (req, reply) => {
    const { username } = req.params as { username: string };
    const row = await findUserByUsername(username);
    if (!row) return reply.code(404).send({ error: "用户不存在" });

    const [stats, works] = await Promise.all([
      getUserProfileStats(row.id),
      listPublicWorksByAuthor(row.id, 24),
    ]);

    const viewerId = req.authUser?.id ?? null;
    const following = viewerId ? await isFollowing(viewerId, row.id) : false;

    return {
      profile: toUserProfile(row, stats),
      works: works.map(toPublicWork),
      isFollowing: following,
      isSelf: viewerId === row.id,
    };
  });

  /** Follow / unfollow a user. */
  app.post("/api/users/:username/follow", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { username } = req.params as { username: string };
    const target = await findUserByUsername(username);
    if (!target) return reply.code(404).send({ error: "用户不存在" });
    if (target.id === user.id) {
      return reply.code(400).send({ error: "不能关注自己" });
    }
    await followUser(user.id, target.id);
    return { isFollowing: true };
  });

  app.delete("/api/users/:username/follow", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { username } = req.params as { username: string };
    const target = await findUserByUsername(username);
    if (!target) return reply.code(404).send({ error: "用户不存在" });
    await unfollowUser(user.id, target.id);
    return { isFollowing: false };
  });
}
