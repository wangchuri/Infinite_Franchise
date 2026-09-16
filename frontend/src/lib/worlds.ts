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
  /** Present on list endpoints (cards): creator identity + counts. */
  creatorName?: string | null;
  creatorUsername?: string | null;
  creatorAvatarUrl?: string | null;
  workCount?: number;
  entryCount?: number;
  followerCount?: number;
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

export type WorldPageKind = "home" | "collection" | "custom";

export type WorldPage = {
  id: string;
  kind: WorldPageKind;
  collectionKey: string | null;
  title: string;
  slug: string;
  sortOrder: number;
  layout: WorldLayout;
  css: string;
  status: "draft" | "published";
  updatedAt: string;
};

function withPage(page: WorldPage): WorldPage {
  return { ...page, layout: normalizeWorldLayout(page.layout) };
}

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
  pages: WorldPage[];
  isOwner: boolean;
  canEdit: boolean;
}> {
  const data = await apiFetch<{
    world: World;
    entries: WikiEntry[];
    timeline: TimelineEvent[];
    collections: WorldCollection[];
    pages?: WorldPage[];
    isOwner: boolean;
    canEdit: boolean;
  }>(`/api/worlds/${encodeURIComponent(slug)}`, {}, { auth: true });
  return {
    ...data,
    world: withConfig(data.world),
    entries: data.entries.map(withEntry),
    collections: normalizeCollections(data.collections),
    pages: (data.pages ?? []).map(withPage),
  };
}

export async function fetchWorldById(id: string): Promise<{
  world: World;
  entries: WikiEntry[];
  timeline: TimelineEvent[];
  collections: WorldCollection[];
  pages: WorldPage[];
  isOwner: boolean;
  canEdit: boolean;
}> {
  const data = await apiFetch<{
    world: World;
    entries: WikiEntry[];
    timeline: TimelineEvent[];
    collections: WorldCollection[];
    pages?: WorldPage[];
    isOwner: boolean;
    canEdit: boolean;
  }>(`/api/worlds/id/${encodeURIComponent(id)}`);
  return {
    ...data,
    world: withConfig(data.world),
    entries: data.entries.map(withEntry),
    collections: normalizeCollections(data.collections),
    pages: (data.pages ?? []).map(withPage),
  };
}

export async function fetchWorldPages(worldId: string): Promise<WorldPage[]> {
  const data = await apiFetch<{ pages: WorldPage[] }>(
    `/api/worlds/${worldId}/pages`,
  );
  return (data.pages ?? []).map(withPage);
}

export async function createWorldPage(
  worldId: string,
  input: {
    kind?: WorldPageKind;
    collectionKey?: string | null;
    title?: string;
    slug?: string;
    layout?: WorldLayout;
    css?: string;
  },
): Promise<WorldPage> {
  const data = await apiFetch<{ page: WorldPage }>(
    `/api/worlds/${worldId}/pages`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return withPage(data.page);
}

export async function updateWorldPage(
  worldId: string,
  pageId: string,
  patch: Partial<{
    title: string;
    slug: string;
    layout: WorldLayout;
    css: string;
    status: "draft" | "published";
    sortOrder: number;
  }>,
): Promise<WorldPage> {
  const data = await apiFetch<{ page: WorldPage }>(
    `/api/worlds/${worldId}/pages/${pageId}`,
    { method: "PATCH", body: JSON.stringify(patch) },
  );
  return withPage(data.page);
}

export async function deleteWorldPage(
  worldId: string,
  pageId: string,
): Promise<void> {
  await apiFetch(`/api/worlds/${worldId}/pages/${pageId}`, {
    method: "DELETE",
  });
}

export type WorldPageRevision = {
  id: string;
  layout: WorldLayout;
  css: string;
  createdAt: string;
};

export async function fetchPageRevisions(
  worldId: string,
  pageId: string,
): Promise<WorldPageRevision[]> {
  const data = await apiFetch<{ revisions: WorldPageRevision[] }>(
    `/api/worlds/${worldId}/pages/${pageId}/revisions`,
  );
  return (data.revisions ?? []).map((r) => ({
    ...r,
    layout: normalizeWorldLayout(r.layout),
  }));
}

export async function restorePageRevision(
  worldId: string,
  pageId: string,
  revisionId: string,
): Promise<WorldPage> {
  const data = await apiFetch<{ page: WorldPage }>(
    `/api/worlds/${worldId}/pages/${pageId}/revisions/${revisionId}/restore`,
    { method: "POST" },
  );
  return withPage(data.page);
}

export type WorldAsset = {
  id: string;
  url: string;
  kind: string;
  filename: string;
  size: number | null;
  width: number | null;
  height: number | null;
  createdAt: string;
};

export async function fetchWorldAssets(
  worldId: string,
): Promise<WorldAsset[]> {
  const data = await apiFetch<{ assets: WorldAsset[] }>(
    `/api/worlds/${worldId}/assets`,
  );
  return data.assets ?? [];
}

export async function recordWorldAsset(
  worldId: string,
  input: {
    url: string;
    filename?: string;
    size?: number | null;
    width?: number | null;
    height?: number | null;
  },
): Promise<WorldAsset> {
  const data = await apiFetch<{ asset: WorldAsset }>(
    `/api/worlds/${worldId}/assets`,
    { method: "POST", body: JSON.stringify(input) },
  );
  return data.asset;
}

export async function deleteWorldAsset(
  worldId: string,
  assetId: string,
): Promise<void> {
  await apiFetch(`/api/worlds/${worldId}/assets/${assetId}`, {
    method: "DELETE",
  });
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
