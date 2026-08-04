import {
  createLocalStorage,
  getLocalUploadDir,
  getPublicFileBaseUrl,
} from "./local.js";
import type { StorageDriver } from "./types.js";

export type { PutObjectResult, StorageDriver } from "./types.js";
export { getLocalUploadDir, getPublicFileBaseUrl };

let cached: StorageDriver | null = null;

export function getStorage(): StorageDriver {
  if (cached) return cached;
  const driver = (process.env.STORAGE_DRIVER ?? "local").toLowerCase();
  if (driver === "local") {
    cached = createLocalStorage({
      uploadDir: getLocalUploadDir(),
      publicBaseUrl: getPublicFileBaseUrl(),
    });
    return cached;
  }
  // Future: s3 / oss — keep interface, switch via STORAGE_DRIVER
  throw new Error(`Unsupported STORAGE_DRIVER: ${driver}`);
}
