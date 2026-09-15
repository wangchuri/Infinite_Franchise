import { apiFetch } from "./api";
import { prepareImage } from "./image";
import {
  normalizeCollections,
  type WorldCollection,
} from "./collections";
import {
  normalizeHomepageConfig,
  type HomepageConfig,
} from "./homepage-config";
import {
  normalizeWorldLayout,
  normalizeEntryLayout,
  type EntryLayout,
  type WorldLayout,
} from "./world-layout";

export type { HomepageConfig };
export type { WorldLayout };
export type { WorldCollection };

export type WorkSubmitMode = "open" | "review" | "invite_only";
export type MemberRole = "creator" | "editor" | "contributor" | "viewer";

export type World = {
  id: string;
  creatorId: string;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  coverUrl: string | null;
  logoUrl: string | null;
  wikiBackgroundUrl: string | null;
  tags: string[];
  status: "draft" | "published";
  welcomeMessage: string | null;
  visibility: "public" | "private";
  allowFork: boolean;
  workSubmitMode: WorkSubmitMode;
  homepageConfig: HomepageConfig;
  layout: WorldLayout;
  createdAt: string;
  updatedAt: string;
};

function withConfig(world: World): World {
  return {
    ...world,
    homepageConfig: normalizeHomepageConfig(world.homepageConfig),
    layout: normalizeWorldLayout(world.layout),
  };
}

export type WikiEntry = {
  id: string;
  worldId: string;
  category: string;
  title: string;
  slug: string;
  aliases: string[];
  content: string;
  contentLayout: EntryLayout;
  imageUrl: string | null;
  attributes: Record<string, string>;
  status: string;
  version: number;
  createdAt: string;
  updatedAt: string;
};

function withEntry(entry: WikiEntry): WikiEntry {
  return { ...entry, contentLayout: normalizeEntryLayout(entry.contentLayout) };
}

export type TimelineEvent = {
  id: string;
  worldId: string;
  title: string;
  description: string;
  eventDate: string;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
};

export async function createWorld(name?: string): Promise<World> {
  const data = await apiFetch<{ world: World }>("/api/worlds", {
    method: "POST",
    body: JSON.stringify({ name }),
  });
  return withConfig(data.world);
}

export async function fetchMyWorlds(): Promise<World[]> {
  const data = await apiFetch<{ worlds: World[] }>("/api/worlds/mine");
  return data.worlds.map(withConfig);
}

export async function fetchFollowedWorlds(limit = 24): Promise<World[]> {
  const data = await apiFetch<{ worlds: World[] }>(
    `/api/worlds/following?limit=${limit}`,
  );
  return data.worlds.map(withConfig);
}

export async function fetchPublicWorlds(limit = 48): Promise<World[]> {
  const data = await apiFetch<{ worlds: World[] }>(
    `/api/worlds?limit=${limit}`,
    {},
    { auth: false },
  );
  return data.worlds.map(withConfig);
}

export async function fetchWorldBySlug(slug: string): Promise<{
  world: World;
  entries: WikiEntry[];
  timeline: TimelineEvent[];
  collections: WorldCollection[];
  isOwner: boolean;
  canEdit: boolean;
}> {
  const data = await apiFetch<{
    world: World;
    entries: WikiEntry[];
    timeline: TimelineEvent[];
    collections: WorldCollection[];
    isOwner: boolean;
    canEdit: boolean;
  }>(`/api/worlds/${encodeURIComponent(slug)}`, {}, { auth: true });
  return {
    ...data,
    world: withConfig(data.world),
    entries: data.entries.map(withEntry),
    collections: normalizeCollections(data.collections),
  };
}

export async function fetchWorldById(id: string): Promise<{
  world: World;
  entries: WikiEntry[];
  timeline: TimelineEvent[];
  collections: WorldCollection[];
  isOwner: boolean;
  canEdit: boolean;
}> {
  const data = await apiFetch<{
    world: World;
    entries: WikiEntry[];
    timeline: TimelineEvent[];
    collections: WorldCollection[];
    isOwner: boolean;
    canEdit: boolean;
  }>(`/api/worlds/id/${encodeURIComponent(id)}`);
  return {
    ...data,
    world: withConfig(data.world),
    entries: data.entries.map(withEntry),
    collections: normalizeCollections(data.collections),
  };
}

export async function updateWorld(
  id: string,
  patch: Partial<{
    name: string;
    tagline: string;
    description: string;
    logoUrl: string | null;
    wikiBackgroundUrl: string | null;
    coverUrl: string | null;
    tags: string[];
    welcomeMessage: string | null;
    homepageConfig: HomepageConfig;
    layout: WorldLayout;
    workSubmitMode: WorkSubmitMode;
  }>,
): Promise<World> {
  const data = await apiFetch<{ world: World }>(`/api/worlds/${id}`, {
    method: "PATCH",
    body: JSON.stringify(patch),
  });
  return withConfig(data.world);
}

export async function publishWorld(id: string): Promise<World> {
  const data = await apiFetch<{ world: World }>(`/api/worlds/${id}/publish`, {
    method: "POST",
  });
  return withConfig(data.world);
}

export async function deleteWorld(id: string): Promise<void> {
  await apiFetch(`/api/worlds/${id}`, { method: "DELETE" });
}

/** Worlds the current user may submit works to. */
export async function fetchContributableWorlds(): Promise<World[]> {
  const data = await apiFetch<{ worlds: World[] }>("/api/worlds/contributable");
  return data.worlds.map(withConfig);
}

export type WorldMember = {
  userId: string;
  username: string;
  displayName: string;
  role: MemberRole;
  joinedAt: string;
};

export async function fetchMembers(worldId: string): Promise<WorldMember[]> {
  const data = await apiFetch<{ members: WorldMember[] }>(
    `/api/worlds/${worldId}/members`,
  );
  return data.members;
}

export async function addMember(
  worldId: string,
  username: string,
  role: MemberRole,
): Promise<WorldMember> {
  const data = await apiFetch<{ member: WorldMember }>(
    `/api/worlds/${worldId}/members`,
    { method: "POST", body: JSON.stringify({ username, role }) },
  );
  return data.member;
}

export async function removeMember(
  worldId: string,
  userId: string,
): Promise<void> {
  await apiFetch(`/api/worlds/${worldId}/members/${userId}`, {
    method: "DELETE",
  });
}

export async function fetchTagPresets(): Promise<string[]> {
  const data = await apiFetch<{ tags: string[] }>("/api/worlds/tag-presets", {}, {
    auth: false,
  });
  return data.tags;
}

export async function fetchEntries(
  worldId: string,
  category?: string,
): Promise<WikiEntry[]> {
  const q = category ? `?category=${encodeURIComponent(category)}` : "";
  const data = await apiFetch<{ entries: WikiEntry[] }>(
    `/api/worlds/${worldId}/entries${q}`,
  );
  return data.entries.map(withEntry);
}

export async function createEntry(
  worldId: string,
  input: {
    category: string;
    title: string;
    content?: string;
    contentLayout?: EntryLayout;
    imageUrl?: string | null;
    attributes?: Record<string, string>;
  },
): Promise<WikiEntry> {
  const data = await apiFetch<{ entry: WikiEntry }>(
    `/api/worlds/${worldId}/entries`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return withEntry(data.entry);
}

export async function updateEntry(
  worldId: string,
  entryId: string,
  patch: Partial<{
    title: string;
    category: string;
    content: string;
    contentLayout: EntryLayout;
    imageUrl: string | null;
    attributes: Record<string, string>;
  }>,
): Promise<WikiEntry> {
  const data = await apiFetch<{ entry: WikiEntry }>(
    `/api/worlds/${worldId}/entries/${entryId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return withEntry(data.entry);
}

export async function deleteEntry(
  worldId: string,
  entryId: string,
): Promise<void> {
  await apiFetch(`/api/worlds/${worldId}/entries/${entryId}`, {
    method: "DELETE",
  });
}

export async function fetchTimeline(worldId: string): Promise<TimelineEvent[]> {
  const data = await apiFetch<{ timeline: TimelineEvent[] }>(
    `/api/worlds/${worldId}/timeline`,
  );
  return data.timeline;
}

export async function createTimelineEvent(
  worldId: string,
  input: { title: string; description?: string; eventDate?: string },
): Promise<TimelineEvent> {
  const data = await apiFetch<{ event: TimelineEvent }>(
    `/api/worlds/${worldId}/timeline`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return data.event;
}

export async function updateTimelineEvent(
  worldId: string,
  eventId: string,
  patch: Partial<{
    title: string;
    description: string;
    eventDate: string;
    sortOrder: number;
  }>,
): Promise<TimelineEvent> {
  const data = await apiFetch<{ event: TimelineEvent }>(
    `/api/worlds/${worldId}/timeline/${eventId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return data.event;
}

export async function deleteTimelineEvent(
  worldId: string,
  eventId: string,
): Promise<void> {
  await apiFetch(`/api/worlds/${worldId}/timeline/${eventId}`, {
    method: "DELETE",
  });
}

export async function uploadImage(file: File): Promise<string> {
  const prepared = await prepareImage(file);
  const form = new FormData();
  form.append("file", prepared);
  const data = await apiFetch<{ url: string }>("/api/uploads", {
    method: "POST",
    body: form,
  });
  return data.url;
}

export async function uploadFont(file: File): Promise<string> {
  const form = new FormData();
  form.append("file", file);
  const data = await apiFetch<{ url: string }>("/api/uploads", {
    method: "POST",
    body: form,
  });
  return data.url;
}

export function excerpt(md: string, max = 72): string {
  const plain = md
    .replace(/[#>*_`\[\]()!-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (plain.length <= max) return plain;
  return `${plain.slice(0, max)}…`;
}
