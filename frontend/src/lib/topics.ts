import { apiFetch } from "./api";

export type TopicStatus = "open" | "resolved";
export type TopicSort = "latest" | "hot";

export type Topic = {
  id: string;
  worldId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  title: string;
  body: string;
  status: TopicStatus;
  pinned: boolean;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
};

export type TopicDetail = {
  topic: Topic;
  isAuthor: boolean;
  canModerate: boolean;
};

export async function fetchTopics(
  worldSlug: string,
  opts: { status?: TopicStatus; sort?: TopicSort } = {},
): Promise<Topic[]> {
  const q = new URLSearchParams();
  if (opts.status) q.set("status", opts.status);
  if (opts.sort) q.set("sort", opts.sort);
  const qs = q.toString();
  const data = await apiFetch<{ topics: Topic[] }>(
    `/api/worlds/${encodeURIComponent(worldSlug)}/topics${qs ? `?${qs}` : ""}`,
  );
  return data.topics;
}

export async function createTopic(
  worldSlug: string,
  input: { title: string; body: string },
): Promise<Topic> {
  const data = await apiFetch<{ topic: Topic }>(
    `/api/worlds/${encodeURIComponent(worldSlug)}/topics`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return data.topic;
}

export async function fetchTopic(id: string): Promise<TopicDetail> {
  return apiFetch<TopicDetail>(`/api/topics/${id}`);
}

export async function updateTopic(
  id: string,
  patch: { title?: string; body?: string; status?: TopicStatus },
): Promise<Topic> {
  const data = await apiFetch<{ topic: Topic }>(`/api/topics/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return data.topic;
}

export async function pinTopic(id: string, pinned: boolean): Promise<Topic> {
  const data = await apiFetch<{ topic: Topic }>(`/api/topics/${id}/pin`, {
    method: "POST",
    body: JSON.stringify({ pinned }),
  });
  return data.topic;
}

export async function deleteTopic(id: string): Promise<void> {
  await apiFetch(`/api/topics/${id}`, { method: "DELETE" });
}
