import multipart from "@fastify/multipart";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { requireAuth } from "../auth/auth-guard.js";
import { getStorage } from "../storage/index.js";

const ALLOWED = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "application/font-woff",
  "application/x-font-ttf",
  "application/x-font-opentype",
  "application/vnd.ms-opentype",
]);
const FONT_EXT = new Set([".ttf", ".otf", ".woff", ".woff2"]);
const MAX_BYTES = 15 * 1024 * 1024;
const MAX_MB = Math.round(MAX_BYTES / 1024 / 1024);

const tooLarge = () => ({ error: `文件过大（上限 ${MAX_MB}MB）` });

function fileExt(mime: string, filename: string): string {
  const lower = filename.toLowerCase();
  const dot = lower.lastIndexOf(".");
  const fext = dot >= 0 ? lower.slice(dot) : "";
  if (FONT_EXT.has(fext)) return fext;
  if (mime === "image/png") return ".png";
  if (mime === "image/webp") return ".webp";
  if (mime === "image/gif") return ".gif";
  return ".jpg";
}

export async function registerUploadRoutes(app: FastifyInstance) {
  await app.register(async (scoped) => {
    await scoped.register(multipart, {
      limits: { fileSize: MAX_BYTES, files: 1 },
    });

    scoped.post("/api/uploads", async (req, reply) => {
      const user = await requireAuth(req, reply);
      if (!user) return;

      let file;
      try {
        file = await req.file();
      } catch {
        return reply.code(400).send(tooLarge());
      }
      if (!file) {
        return reply.code(400).send({ error: "file is required" });
      }

      const mime = file.mimetype;
      const lower = file.filename.toLowerCase();
      const fext = lower.slice(lower.lastIndexOf("."));
      if (!ALLOWED.has(mime) && !FONT_EXT.has(fext)) {
        return reply.code(400).send({
          error: "只支持图片或字体（jpeg/png/webp/gif/ttf/otf/woff/woff2）",
        });
      }

      let buf: Buffer;
      try {
        buf = await file.toBuffer();
      } catch {
        return reply.code(400).send(tooLarge());
      }
      if (buf.length > MAX_BYTES) {
        return reply.code(400).send(tooLarge());
      }

      const ext = fileExt(mime, file.filename);

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
