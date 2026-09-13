import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { verifyAccessToken } from "./auth.js";
import { findUserById, type PublicUser, toPublicUser, type UserRow } from "../services/users.js";

export type AuthUser = PublicUser & { raw: UserRow };

declare module "fastify" {
  interface FastifyRequest {
    authUser: AuthUser | null;
  }
}

function getBearer(req: FastifyRequest): string | null {
  const h = req.headers.authorization;
  if (!h?.startsWith("Bearer ")) return null;
  return h.slice(7).trim() || null;
}

/**
 * 用户隔离约定：
 * - 受保护接口必须先 requireAuth
 * - 业务查询一律用 request.authUser.id（来自 JWT），禁止信任客户端传来的 userId
 * - 例如：只查自己的作品 WHERE author_id = authUser.id
 */
export async function registerAuthPlugin(app: FastifyInstance) {
  app.decorateRequest("authUser", null);

  app.addHook("preHandler", async (req) => {
    req.authUser = null;
    const token = getBearer(req);
    if (!token) return;
    const payload = await verifyAccessToken(token);
    if (!payload) return;
    const row = await findUserById(payload.userId);
    if (!row || row.status !== "active") return;
    req.authUser = { ...toPublicUser(row), raw: row };
  });
}

export async function requireAuth(
  req: FastifyRequest,
  reply: FastifyReply,
): Promise<AuthUser | null> {
  if (!req.authUser) {
    await reply.code(401).send({ error: "unauthorized" });
    return null;
  }
  return req.authUser;
}
