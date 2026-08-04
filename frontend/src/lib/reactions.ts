import { apiFetch } from "./api";

export type ReactionTargetType = "work" | "entry" | "timeline";

export type ReactionType = {
  key: string;
  label: string;
  icon: string;
  description: string;
  sortOrder: number;
};

export type ReactionSummary = {
  types: ReactionType[];
  counts: Record<string, number>;
  mine: string[];
};

export async function fetchReactionTypes(): Promise<ReactionType[]> {
  const data = await apiFetch<{ types: ReactionType[] }>(
    "/api/reactions/types",
    {},
    { auth: false },
  );
  return data.types;
}

export async function fetchReactionSummary(
  targetType: ReactionTargetType,
  targetId: string,
): Promise<ReactionSummary> {
  const q = `targetType=${encodeURIComponent(targetType)}&targetId=${encodeURIComponent(targetId)}`;
  return apiFetch<ReactionSummary>(`/api/reactions/summary?${q}`);
}

export async function toggleReaction(
  targetType: ReactionTargetType,
  targetId: string,
  reactionType: string,
): Promise<ReactionSummary> {
  return apiFetch<ReactionSummary>("/api/reactions/toggle", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, reactionType }),
  });
}
