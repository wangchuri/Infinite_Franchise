import { apiFetch } from "./api";

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
