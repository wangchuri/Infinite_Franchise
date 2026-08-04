import { apiFetch } from "./api";
import type { ReactionTargetType } from "./reactions";

export type WorkComment = {
  id: string;
  userId: string;
  username: string;
  displayName: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export async function fetchComments(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<WorkComment[]> {
  const q = `targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`;
  const data = await apiFetch<{ comments: WorkComment[] }>(
    `/api/comments?${q}`,
    {},
    { auth: false },
  );
  return data.comments;
}

export async function createComment(
  targetType: ReactionTargetType,
  targetId: string,
  content: string,
): Promise<WorkComment> {
  const data = await apiFetch<{ comment: WorkComment }>("/api/comments", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, content }),
  });
  return data.comment;
}

export async function deleteComment(id: string): Promise<void> {
  await apiFetch(`/api/comments/${id}`, { method: "DELETE" });
}
