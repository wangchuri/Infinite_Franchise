/**
 * Client-side image prep before upload: downscale oversized images and
 * re-encode so large photos don't blow the server's size limit.
 * Keeps GIFs (animation) untouched and falls back to the original on failure.
 */
const MAX_DIM = 2400;
const TARGET_BYTES = 12 * 1024 * 1024;

function toBlob(canvas: HTMLCanvasElement, type: string): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, 0.85));
}

export async function prepareImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.type === "image/gif") return file;
  if (
    typeof document === "undefined" ||
    typeof createImageBitmap === "undefined"
  ) {
    return file;
  }

  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIM / Math.max(bitmap.width, bitmap.height));
    if (scale === 1 && file.size <= TARGET_BYTES) {
      bitmap.close();
      return file;
    }

    const w = Math.max(1, Math.round(bitmap.width * scale));
    const h = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      bitmap.close();
      return file;
    }
    ctx.drawImage(bitmap, 0, 0, w, h);
    bitmap.close();

    const preserveType =
      file.type === "image/png" || file.type === "image/webp";
    let outType = preserveType ? "image/png" : "image/jpeg";
    let blob = await toBlob(canvas, outType);
    if (blob && blob.size > TARGET_BYTES && preserveType) {
      const jpeg = await toBlob(canvas, "image/jpeg");
      if (jpeg && jpeg.size < blob.size) {
        blob = jpeg;
        outType = "image/jpeg";
      }
    }
    if (!blob || blob.size >= file.size) return file;

    const ext = outType === "image/png" ? ".png" : ".jpg";
    const name = file.name.replace(/\.[^.]+$/, "") + ext;
    return new File([blob], name, { type: outType });
  } catch {
    return file;
  }
}
