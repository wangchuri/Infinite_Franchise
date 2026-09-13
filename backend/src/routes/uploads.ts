import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { requireAuth } from "../auth/auth-guard.js";
import { getStorage } from "../storage/index.js";

const ALLOWED = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
const MAX_BYTES = 5 * 1024 * 1024;

export async function registerUploadRoutes(app: FastifyInstance) {
  await app.register(async (scoped) => {
    await scoped.register(multipart, {
      limits: { fileSize: MAX_BYTES, files: 1 },
    });

    scoped.post("/api/uploads", async (req, reply) => {
      const user = await requireAuth(req, reply);
      if (!user) return;

      const file = await req.file();
      if (!file) {
        return reply.code(400).send({ error: "file is required" });
      }

      const mime = file.mimetype;
      if (!ALLOWED.has(mime)) {
        return reply
          .code(400)
          .send({ error: "only jpeg, png, webp, gif images are allowed" });
      }

      const buf = await file.toBuffer();
      if (buf.length > MAX_BYTES) {
        return reply.code(400).send({ error: "file too large (max 5MB)" });
      }

      const ext =
        mime === "image/png"
          ? ".png"
          : mime === "image/webp"
            ? ".webp"
            : mime === "image/gif"
              ? ".gif"
              : ".jpg";

      const key = path.posix.join(
        "worlds",
        user.id,
        `${Date.now()}-${randomUUID().slice(0, 8)}${ext}`,
      );

      const stored = await getStorage().putObject(key, buf, mime);
      return reply.code(201).send({ url: stored.url, key: stored.key });
    });
  });
}
