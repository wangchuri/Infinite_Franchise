const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:4000";

const ACCESS_KEY = "if_access_token";
const REFRESH_KEY = "if_refresh_token";

export type AuthUser = {
  id: string;
  username: string;
  email: string;
  displayName: string;
  avatarUrl: string | null;
  bio: string | null;
  contactEmail: string | null;
  linkUrl: string | null;
  coverUrl: string | null;
  emailVerified: boolean;
  createdAt: string;
};

export type AuthResponse = {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
  note?: string;
};

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(ACCESS_KEY);
}

export function setTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(ACCESS_KEY, accessToken);
  localStorage.setItem(REFRESH_KEY, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as { error?: string };
    return data.error ?? `请求失败 (${res.status})`;
  } catch {
    return `请求失败 (${res.status})`;
  }
}

export async function register(input: {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<AuthResponse>;
}

export async function login(input: {
  login: string;
  password: string;
}): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  if (!res.ok) throw new Error(await parseError(res));
  return res.json() as Promise<AuthResponse>;
}

export async function fetchMe(): Promise<AuthUser> {
  const token = getAccessToken();
  if (!token) throw new Error("未登录");
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    if (res.status === 401) clearTokens();
    throw new Error(await parseError(res));
  }
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}

export async function updateMe(
  patch: Partial<{
    displayName: string;
    bio: string | null;
    contactEmail: string | null;
    linkUrl: string | null;
    avatarUrl: string | null;
    coverUrl: string | null;
  }>,
): Promise<AuthUser> {
  const token = getAccessToken();
  if (!token) throw new Error("未登录");
  const res = await fetch(`${API_BASE}/api/auth/me`, {
    method: "PATCH",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(patch),
  });
  if (!res.ok) throw new Error(await parseError(res));
  const data = (await res.json()) as { user: AuthUser };
  return data.user;
}
