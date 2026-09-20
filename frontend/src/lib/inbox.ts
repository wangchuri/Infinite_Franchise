import { apiFetch } from "./api";
import type { MemberRole } from "./worlds";

export type InviteDirection = "invite" | "request";

/** An invite (world -> me) or join request (someone -> my world) I can answer. */
export type InboxInvite = {
  id: string;
  direction: InviteDirection;
  role: MemberRole;
  message: string | null;
  createdAt: string;
  worldId: string;
  worldName: string;
  worldSlug: string;
  worldVisibility: "public" | "private";
  actorId: string;
  actorUsername: string;
  actorDisplayName: string;
  actorAvatarUrl: string | null;
};

/** A pending invite a world sent out. */
export type SentInvite = {
  id: string;
  role: MemberRole;
  createdAt: string;
  inviteeId: string;
  inviteeUsername: string;
  inviteeDisplayName: string;
  inviteeAvatarUrl: string | null;
};

export type InboxNotification = {
  id: string;
  type: string;
  payload: Record<string, unknown>;
  readAt: string | null;
  createdAt: string;
  worldId: string | null;
  worldName: string | null;
  worldSlug: string | null;
  workId: string | null;
  workTitle: string | null;
  inviteId: string | null;
  actorId: string | null;
  actorUsername: string | null;
  actorDisplayName: string | null;
};

export type InboxPayload = {
  invites: InboxInvite[];
  notifications: InboxNotification[];
  unread: number;
};

export async function fetchInbox(limit = 40): Promise<InboxPayload> {
  return apiFetch<InboxPayload>(`/api/inbox?limit=${limit}`, {
    cache: "no-store",
  });
}

export async function fetchUnreadCount(): Promise<number> {
  const data = await apiFetch<{ unread: number }>("/api/inbox/count", {
    cache: "no-store",
  });
  return data.unread;
}

export async function respondToInvite(
  id: string,
  accept: boolean,
): Promise<void> {
  await apiFetch(`/api/inbox/invites/${id}/${accept ? "accept" : "decline"}`, {
    method: "POST",
  });
}

export async function markNotificationsRead(ids?: string[]): Promise<void> {
  await apiFetch("/api/inbox/read", {
    method: "POST",
    body: JSON.stringify(ids && ids.length > 0 ? { ids } : {}),
  });
}

/** Invite a member by username; the invitee must accept. */
export async function inviteMember(
  worldId: string,
  username: string,
  role: MemberRole,
): Promise<SentInvite> {
  const data = await apiFetch<{ invite: SentInvite }>(
    `/api/worlds/${worldId}/members`,
    { method: "POST", body: JSON.stringify({ username, role }) },
  );
  return data.invite;
}

/** Pending sent invites + incoming join requests for a world. */
export async function fetchWorldInvites(
  worldId: string,
): Promise<{ sent: SentInvite[]; requests: InboxInvite[] }> {
  return apiFetch<{ sent: SentInvite[]; requests: InboxInvite[] }>(
    `/api/worlds/${worldId}/invites`,
  );
}

export async function revokeWorldInvite(
  worldId: string,
  inviteId: string,
): Promise<void> {
  await apiFetch(`/api/worlds/${worldId}/invites/${inviteId}`, {
    method: "DELETE",
  });
}

const ROLE_LABELS: Record<MemberRole, string> = {
  creator: "创建者",
  editor: "编辑",
  contributor: "贡献者",
  viewer: "浏览者",
};

export function memberRoleLabel(role: MemberRole): string {
  return ROLE_LABELS[role] ?? role;
}

/** One-line summary of who did what for an invite/request. */
export function inviteText(invite: InboxInvite): string {
  const who = invite.actorDisplayName || `@${invite.actorUsername}`;
  return invite.direction === "invite"
    ? `${who} 邀请你以「${memberRoleLabel(invite.role)}」加入《${invite.worldName}》`
    : `${who} 申请加入《${invite.worldName}》`;
}

export function notificationText(n: InboxNotification): string {
  const who = n.actorDisplayName || (n.actorUsername ? `@${n.actorUsername}` : "有人");
  const title =
    (typeof n.payload.title === "string" && n.payload.title) || n.workTitle || "";
  switch (n.type) {
    case "world_invite":
      return `${who} 邀请你加入《${n.worldName ?? "一个世界"}》`;
    case "world_request":
      return `${who} 申请加入《${n.worldName ?? ""}》`;
    case "invite_accepted":
      return `${who} 接受了加入《${n.worldName ?? ""}》的邀请`;
    case "invite_declined":
      return `${who} 婉拒了加入《${n.worldName ?? ""}》的邀请`;
    case "work_pending":
      return `${who} 投稿了《${title}》，等待审核`;
    case "work_approved":
      return `你的《${title}》已通过审核`;
    case "work_rejected":
      return `你的《${title}》被驳回`;
    default:
      return `${who} 触发了一条通知`;
  }
}

export function notificationHref(n: InboxNotification): string | null {
  switch (n.type) {
    case "work_pending":
      return n.worldId ? `/worlds/${n.worldId}/edit` : null;
    case "world_request":
      return n.worldId ? `/worlds/${n.worldId}/edit` : null;
    case "work_approved":
    case "work_rejected":
      return n.workId ? `/works/${n.workId}` : null;
    case "invite_accepted":
    case "invite_declined":
      return n.worldSlug ? `/w/${n.worldSlug}` : null;
    default:
      return n.worldSlug ? `/w/${n.worldSlug}` : null;
  }
}

