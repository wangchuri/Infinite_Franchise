import { apiFetch } from "./api";

export type WorkType =
  | "novel"
  | "chapter"
  | "story"
  | "artwork"
  | "audio"
  | "video"
  | "other";

export type Work = {
  id: string;
  worldId: string;
  worldName: string;
  worldSlug: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  type: WorkType;
  title: string;
  summary: string | null;
  content: string | null;
  mediaUrl: string | null;
  status: string;
  parentId: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  reactionCounts: Record<string, number>;
};

export type WorkChapterRef = {
  id: string;
  title: string;
  publishedAt: string | null;
};

export type WorkAnnotation = {
  id: string;
  worldId: string;
  category: string;
  title: string;
  slug: string;
  aliases: string[];
  content: string;
  imageUrl: string | null;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  source: "link" | "mention";
  excerpt: string;
};

export type WorkReadPayload = {
  work: Work;
  novel: Work | null;
  chapters: WorkChapterRef[];
  prevChapter: WorkChapterRef | null;
  nextChapter: WorkChapterRef | null;
  annotations: WorkAnnotation[];
};

export const WORK_TYPE_LABEL: Record<WorkType, string> = {
  novel: "长篇",
  chapter: "章节",
  story: "短篇",
  artwork: "美术",
  audio: "音频",
  video: "视频",
  other: "其他",
};

export async function fetchPublicWorks(limit = 40): Promise<Work[]> {
  const data = await apiFetch<{ works: Work[] }>(
    `/api/works?limit=${limit}`,
    {},
    { auth: false },
  );
  return data.works;
}

export async function fetchWorkById(id: string): Promise<Work> {
  const data = await apiFetch<{ work: Work }>(
    `/api/works/${id}`,
    {},
    { auth: false },
  );
  return data.work;
}

export async function fetchWorkRead(id: string): Promise<WorkReadPayload> {
  return apiFetch<WorkReadPayload>(`/api/works/${id}/read`, {}, { auth: false });
}

/** Pending works awaiting review in a world (creator/editor only). */
export async function fetchPendingWorks(worldId: string): Promise<Work[]> {
  const data = await apiFetch<{ works: Work[] }>(
    `/api/worlds/${worldId}/works/pending`,
  );
  return data.works;
}

export async function reviewWork(
  workId: string,
  action: "approve" | "reject",
  reason?: string,
): Promise<Work> {
  const data = await apiFetch<{ work: Work }>(`/api/works/${workId}/review`, {
    method: "POST",
    body: JSON.stringify({ action, reason }),
  });
  return data.work;
}

export async function createWork(input: {
  worldId: string;
  type: WorkType;
  title: string;
  summary?: string;
  content?: string;
  mediaUrl?: string | null;
  parentId?: string | null;
  publish?: boolean;
}): Promise<Work> {
  const data = await apiFetch<{ work: Work }>("/api/works", {
    method: "POST",
    body: JSON.stringify(input),
  });
  return data.work;
}

/** Stable across SSR/CSR. */
export function formatWorkTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

/** Split markdown into page chunks by paragraph packing. */
export function paginateContent(content: string, pageSize = 900): string[] {
  const text = content.replace(/\r\n/g, "\n").trim();
  if (!text) return [];
  const paras = text.split(/\n{2,}/);
  const pages: string[] = [];
  let buf = "";
  for (const p of paras) {
    const next = buf ? `${buf}\n\n${p}` : p;
    if (buf && next.length > pageSize) {
      pages.push(buf);
      buf = p;
    } else {
      buf = next;
    }
  }
  if (buf) pages.push(buf);
  return pages.length ? pages : [text];
}
