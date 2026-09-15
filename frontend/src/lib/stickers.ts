import { apiFetch } from "./api";

export type StickerInfo = {
  id: string;
  label: string;
  artworkId: string;
  artworkUrl: string | null;
  usageCount: number;
};

export type WorkStickerInfo = {
  sticker: StickerInfo | null;
  canManage: boolean;
};

export async function fetchWorkSticker(
  workId: string,
): Promise<WorkStickerInfo> {
  return apiFetch<WorkStickerInfo>(`/api/works/${workId}/sticker`);
}

export async function setWorkSticker(workId: string): Promise<StickerInfo> {
  const data = await apiFetch<{ sticker: StickerInfo }>(
    `/api/works/${workId}/sticker`,
    { method: "POST" },
  );
  return data.sticker;
}

export async function removeWorkSticker(workId: string): Promise<void> {
  await apiFetch(`/api/works/${workId}/sticker`, { method: "DELETE" });
}
