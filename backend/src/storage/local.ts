import fs from "node:fs/promises";
import path from "node:path";
import type { PutObjectResult, StorageDriver } from "./types.js";

export function createLocalStorage(input: {
  uploadDir: string;
  publicBaseUrl: string;
}): StorageDriver {
  const root = path.resolve(input.uploadDir);
  const base = input.publicBaseUrl.replace(/\/$/, "");

  return {
    async putObject(
      key: string,
      data: Buffer,
      _contentType: string,
    ): Promise<PutObjectResult> {
      const safeKey = key.replace(/\\/g, "/").replace(/^\/+/, "");
      const fullPath = path.join(root, safeKey);
      await fs.mkdir(path.dirname(fullPath), { recursive: true });
      await fs.writeFile(fullPath, data);
      return {
        key: safeKey,
        url: `${base}/${safeKey}`,
      };
    },
  };
}

export function getLocalUploadDir(): string {
  return path.resolve(process.env.LOCAL_UPLOAD_DIR ?? "./uploads");
}

export function getPublicFileBaseUrl(): string {
  return (
    process.env.PUBLIC_FILE_BASE_URL ?? "http://localhost:4000/files"
  ).replace(/\/$/, "");
}
