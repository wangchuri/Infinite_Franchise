import { apiFetch } from "./api";

export type ReactionTargetType = "work" | "entry" | "timeline" | "topic";

export type ReactionScope = "global" | "world";
export type ReactionKind = "emoji" | "artwork";

export type ReactionType = {
  id: string;
  key: string;
  label: string;
  icon: string;
  description: string;
  sortOrder: number;
  scope: ReactionScope;
  kind: ReactionKind;
  worldId: string | null;
  artworkId: string | null;
  artworkUrl: string | null;
};

export type ReactionSummary = {
  types: ReactionType[];
  /** reaction_type_id → count */
  counts: Record<string, number>;
  /** reaction_type_ids the current viewer has reacted with */
  mine: string[];
};

export async function fetchReactionTypes(
  worldId?: string | null,
): Promise<ReactionType[]> {
  const q = worldId ? `?worldId=${encodeURIComponent(worldId)}` : "";
  const data = await apiFetch<{ types: ReactionType[] }>(
    `/api/reactions/types${q}`,
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
  reactionTypeId: string,
): Promise<ReactionSummary> {
  return apiFetch<ReactionSummary>("/api/reactions/toggle", {
    method: "POST",
    body: JSON.stringify({ targetType, targetId, reactionTypeId }),
  });
}

/** Broadcast a reaction change so sibling bars (e.g. footer + context menu) stay in sync. */
export const REACTIONS_CHANGED = "if:reactions-changed";

export type ReactionsChangedDetail = {
  targetType: ReactionTargetType;
  targetId: string;
  summary: ReactionSummary;
};

export function announceReactions(detail: ReactionsChangedDetail): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(REACTIONS_CHANGED, { detail }));
}

// —— World custom reactions (creator / editor management) ——

export type WorldReactionType = ReactionType & { active: boolean };

export async function fetchWorldReactionTypes(
  worldId: string,
): Promise<WorldReactionType[]> {
  const data = await apiFetch<{ types: WorldReactionType[] }>(
    `/api/worlds/${worldId}/reaction-types`,
  );
  return data.types;
}

export async function createWorldReactionType(
  worldId: string,
  input: { label: string; icon: string },
): Promise<WorldReactionType> {
  const data = await apiFetch<{ type: WorldReactionType }>(
    `/api/worlds/${worldId}/reaction-types`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return data.type;
}

export async function updateWorldReactionType(
  worldId: string,
  typeId: string,
  patch: { label?: string; icon?: string; active?: boolean },
): Promise<WorldReactionType> {
  const data = await apiFetch<{ type: WorldReactionType }>(
    `/api/worlds/${worldId}/reaction-types/${typeId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return data.type;
}

export async function deleteWorldReactionType(
  worldId: string,
  typeId: string,
): Promise<void> {
  await apiFetch(`/api/worlds/${worldId}/reaction-types/${typeId}`, {
    method: "DELETE",
  });
}
