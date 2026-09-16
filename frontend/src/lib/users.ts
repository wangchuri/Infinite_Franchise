import { apiFetch } from "./api";
import type { Work } from "./works";

export type UserSearchItem = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
};

export async function searchUsers(q: string): Promise<UserSearchItem[]> {
  const data = await apiFetch<{ users: UserSearchItem[] }>(
    `/api/users/search?q=${encodeURIComponent(q)}`,
  );
  return data.users;
}

export type UserProfile = {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  contactEmail: string | null;
  linkUrl: string | null;
  coverUrl: string | null;
  createdAt: string;
  works: number;
  followers: number;
  following: number;
};

export type UserProfilePayload = {
  profile: UserProfile;
  works: Work[];
  isFollowing: boolean;
  isSelf: boolean;
};

export async function fetchUserProfile(
  username: string,
): Promise<UserProfilePayload> {
  return apiFetch<UserProfilePayload>(
    `/api/users/${encodeURIComponent(username)}`,
  );
}

export async function followUser(username: string): Promise<void> {
  await apiFetch(`/api/users/${encodeURIComponent(username)}/follow`, {
    method: "POST",
  });
}

export async function unfollowUser(username: string): Promise<void> {
  await apiFetch(`/api/users/${encodeURIComponent(username)}/follow`, {
    method: "DELETE",
  });
}
