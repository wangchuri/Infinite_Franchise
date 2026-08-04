import type { FastifyInstance, FastifyRequest } from "fastify";
import {
  createRefreshToken,
  hashPassword,
  hashRefreshToken,
  refreshExpiresAt,
  signAccessToken,
  validateRegisterInput,
  verifyPassword,
} from "../auth.js";
import { requireAuth } from "../auth-guard.js";
import {
  createSession,
  createUser,
  findUserByEmailOrUsername,
  toPublicUser,
  touchLastLogin,
} from "../users.js";

function clientMeta(req: FastifyRequest): {
  userAgent: string | null;
  ip: string | null;
} {
  const userAgent = req.headers["user-agent"] ?? null;
  const ip = req.ip || null;
  return { userAgent, ip };
}

export async function registerAuthRoutes(app: FastifyInstance) {
  app.post("/api/auth/register", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const parsed = validateRegisterInput(body);
    if (!parsed.ok) {
      return reply.code(400).send({ error: parsed.error });
    }

    const existingEmail = await findUserByEmailOrUsername(parsed.data.email);
    const existingUsername = await findUserByEmailOrUsername(
      parsed.data.username,
    );
    if (existingEmail || existingUsername) {
      return reply.code(409).send({ error: "email or username already taken" });
    }

    try {
      const passwordHash = await hashPassword(parsed.data.password);
      const user = await createUser({
        username: parsed.data.username,
        email: parsed.data.email,
        passwordHash,
        displayName: parsed.data.displayName,
      });

      const accessToken = await signAccessToken(user.id);
      const refreshToken = createRefreshToken();
      const { userAgent, ip } = clientMeta(req);
      await createSession({
        userId: user.id,
        refreshTokenHash: hashRefreshToken(refreshToken),
        expiresAt: refreshExpiresAt(),
        userAgent,
        ip,
      });
      await touchLastLogin(user.id);

      return reply.code(201).send({
        user: toPublicUser(user),
        accessToken,
        refreshToken,
        note: "Local mock auth: no email/SMS verification yet.",
      });
    } catch (err: unknown) {
      const code =
        err && typeof err === "object" && "code" in err
          ? String((err as { code: unknown }).code)
          : "";
      if (code === "23505") {
        return reply.code(409).send({ error: "email or username already taken" });
      }
      throw err;
    }
  });

  app.post("/api/auth/login", async (req, reply) => {
    const body = (req.body ?? {}) as Record<string, unknown>;
    const login =
      typeof body.login === "string"
        ? body.login.trim()
        : typeof body.email === "string"
          ? body.email.trim()
          : typeof body.username === "string"
            ? body.username.trim()
            : "";
    const password = typeof body.password === "string" ? body.password : "";

    if (!login || !password) {
      return reply.code(400).send({ error: "login and password are required" });
    }

    const user = await findUserByEmailOrUsername(login);
    if (!user || user.status !== "active") {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const ok = await verifyPassword(password, user.password_hash);
    if (!ok) {
      return reply.code(401).send({ error: "invalid credentials" });
    }

    const accessToken = await signAccessToken(user.id);
    const refreshToken = createRefreshToken();
    const { userAgent, ip } = clientMeta(req);
    await createSession({
      userId: user.id,
      refreshTokenHash: hashRefreshToken(refreshToken),
      expiresAt: refreshExpiresAt(),
      userAgent,
      ip,
    });
    await touchLastLogin(user.id);

    return {
      user: toPublicUser(user),
      accessToken,
      refreshToken,
    };
  });

  app.get("/api/auth/me", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { raw: _raw, ...publicUser } = user;
    return { user: publicUser };
  });
}
