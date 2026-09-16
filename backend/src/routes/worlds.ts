import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth/auth-guard.js";
import {
  addMember,
  canReviewWorks,
  getMemberRole,
  listContributableWorlds,
  listMembers,
  removeMember,
} from "../services/collab.js";
import { normalizeHomepageConfig } from "../config/homepage-config.js";
import { normalizeWorldLayout, type WorldLayout } from "../config/world-layout.js";
import { findUserByEmailOrUsername } from "../services/users.js";
import {
  canViewWorld,
  createDraftWorld,
  findWorldById,
  findWorldBySlug,
  isWorldCreator,
  listMyWorlds,
  listPublicWorlds,
  listFollowedWorlds,
  publishWorld,
  softDeleteWorld,
  TAG_PRESETS,
  toPublicWorld,
  updateWorld,
  MEMBER_ROLES,
  WORK_SUBMIT_MODES,
  type MemberRole,
  type WorkSubmitMode,
  type WorldRow,
} from "../services/worlds.js";
import {
  countWorldReactionTypes,
  createWorldReactionType,
  deleteWorldReactionType,
  listWorldReactionTypes,
  updateWorldReactionType,
  WORLD_REACTION_MAX,
} from "../services/reactions.js";
import {
  createEntry,
  createTimelineEvent,
  deleteTimelineEvent,
  findEntryById,
  findTimelineEvent,
  listEntries,
  listTimeline,
  softDeleteEntry,
  toPublicEntry,
  toPublicTimeline,
  updateEntry,
  updateTimelineEvent,
} from "../services/wiki.js";
import {
  createCollection,
  deleteCollection,
  isValidCategory,
  listCollections,
  toPublicCollection,
  updateCollection,
} from "../services/collections.js";
import {
  createWorldPage,
  listWorldPages,
  softDeleteWorldPage,
  toPublicWorldPage,
  updateWorldPage,
  PAGE_KINDS,
  type PageKind,
} from "../services/pages.js";
import { sanitizeAttrFields } from "../config/collections.js";

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNullableString(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string") return v;
  return undefined;
}

function asRecord(v: unknown): Record<string, string> | undefined {
  if (!v || typeof v !== "object" || Array.isArray(v)) return undefined;
  const out: Record<string, string> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === "string") out[k] = val;
  }
  return out;
}

function asStringArray(v: unknown): string[] | undefined {
  if (!Array.isArray(v)) return undefined;
  const seen = new Set<string>();
  const out: string[] = [];
  for (const x of v) {
    if (typeof x !== "string") continue;
    const t = x.trim().slice(0, 32);
    if (!t || seen.has(t)) continue;
    seen.add(t);
    out.push(t);
    if (out.length >= 20) break;
  }
  return out;
}

async function loadOwnedWorld(
  worldId: string,
  userId: string,
): Promise<ReturnType<typeof findWorldById> extends Promise<infer T> ? T : never> {
  const world = await findWorldById(worldId);
  if (!world || !isWorldCreator(world, userId)) return null;
  return world;
}

/** Creator or editor may manage world-level settings (e.g. custom reactions). */
async function loadManageableWorld(
  worldId: string,
  userId: string,
): Promise<WorldRow | null> {
  const world = await findWorldById(worldId);
  if (!world) return null;
  const role = await getMemberRole(worldId, userId);
  if (!canReviewWorks({ world, role, userId })) return null;
  return world;
}

export async function registerWorldRoutes(app: FastifyInstance) {
  app.get("/api/worlds/tag-presets", async () => {
    return { tags: [...TAG_PRESETS] };
  });

  /** Plaza: published public worlds (no auth required). */
  app.get("/api/worlds", async (req) => {
    const q = req.query as { limit?: string };
    const limit = q.limit ? Number(q.limit) : 48;
    const rows = await listPublicWorlds(
      Number.isFinite(limit) ? limit : 48,
    );
    return { worlds: rows.map(toPublicWorld) };
  });

  app.post("/api/worlds", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    const world = await createDraftWorld({
      creatorId: user.id,
      name,
    });
    return reply.code(201).send({ world: toPublicWorld(world) });
  });

  app.get("/api/worlds/mine", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const rows = await listMyWorlds(user.id);
    return { worlds: rows.map(toPublicWorld) };
  });

  /** Plaza left rail: followed worlds. */
  app.get("/api/worlds/following", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const q = req.query as { limit?: string };
    const limit = q.limit ? Number(q.limit) : 24;
    const rows = await listFollowedWorlds(
      user.id,
      Number.isFinite(limit) ? limit : 24,
    );
    return { worlds: rows.map(toPublicWorld) };
  });

  /** Worlds the current user may submit works to (for the create page). */
  app.get("/api/worlds/contributable", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const rows = await listContributableWorlds(user.id);
    return { worlds: rows.map(toPublicWorld) };
  });

  /** Member list (creator or editor may view). */
  app.get("/api/worlds/:id/members", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await findWorldById(id);
    if (!world) return reply.code(404).send({ error: "world not found" });
    const role = await getMemberRole(id, user.id);
    if (!canReviewWorks({ world, role, userId: user.id })) {
      return reply.code(403).send({ error: "无权查看成员列表" });
    }
    return { members: await listMembers(id) };
  });

  /** Invite a member (creator only). */
  app.post("/api/worlds/:id/members", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const username =
      typeof body.username === "string" ? body.username.trim() : "";
    const roleRaw = typeof body.role === "string" ? body.role : "";
    if (!username || !roleRaw) {
      return reply.code(400).send({ error: "username and role are required" });
    }
    if (!(MEMBER_ROLES as readonly string[]).includes(roleRaw) || roleRaw === "creator") {
      return reply.code(400).send({ error: "invalid role" });
    }

    const target = await findUserByEmailOrUsername(username);
    if (!target || target.status !== "active") {
      return reply.code(404).send({ error: "用户不存在" });
    }
    const member = await addMember(id, target.id, roleRaw as MemberRole);
    return reply.code(201).send({ member });
  });

  /** Remove a member (creator only, cannot remove creator/self). */
  app.delete("/api/worlds/:id/members/:userId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, userId } = req.params as { id: string; userId: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const ok = await removeMember(id, userId, user.id);
    if (!ok) {
      return reply.code(400).send({ error: "无法移除该成员" });
    }
    return reply.code(204).send();
  });

  // —— World custom reactions (creator / editor) ——
  app.get("/api/worlds/:id/reaction-types", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }
    return { types: await listWorldReactionTypes(id) };
  });

  app.post("/api/worlds/:id/reaction-types", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const label = asString(body.label)?.trim().slice(0, 24) ?? "";
    const icon = asString(body.icon)?.trim().slice(0, 16) ?? "";
    if (!label || !icon) {
      return reply.code(400).send({ error: "label 和 icon 不能为空" });
    }
    if ((await countWorldReactionTypes(id)) >= WORLD_REACTION_MAX) {
      return reply
        .code(400)
        .send({ error: `自定义反应最多 ${WORLD_REACTION_MAX} 个` });
    }

    const type = await createWorldReactionType({
      worldId: id,
      userId: user.id,
      label,
      icon,
    });
    return reply.code(201).send({ type });
  });

  app.patch("/api/worlds/:id/reaction-types/:typeId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, typeId } = req.params as { id: string; typeId: string };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const label = asString(body.label)?.trim().slice(0, 24);
    const icon = asString(body.icon)?.trim().slice(0, 16);
    if (label !== undefined && !label) {
      return reply.code(400).send({ error: "label 不能为空" });
    }
    if (icon !== undefined && !icon) {
      return reply.code(400).send({ error: "icon 不能为空" });
    }
    const active =
      typeof body.active === "boolean" ? body.active : undefined;
    const sortOrder =
      typeof body.sortOrder === "number" ? body.sortOrder : undefined;

    const type = await updateWorldReactionType({
      id: typeId,
      worldId: id,
      label,
      icon,
      active,
      sortOrder,
    });
    if (!type) return reply.code(404).send({ error: "反应类型不存在" });
    return { type };
  });

  app.delete("/api/worlds/:id/reaction-types/:typeId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, typeId } = req.params as { id: string; typeId: string };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }
    const ok = await deleteWorldReactionType(typeId, id);
    if (!ok) return reply.code(404).send({ error: "反应类型不存在" });
    return reply.code(204).send();
  });

  app.get("/api/worlds/id/:id", async (req, reply) => {
    const { id } = req.params as { id: string };
    const world = await findWorldById(id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const viewerId = req.authUser?.id ?? null;
    if (!canViewWorld(world, viewerId)) {
      return reply.code(404).send({ error: "world not found" });
    }

    const isOwner = viewerId != null && isWorldCreator(world, viewerId);
    const role = viewerId ? await getMemberRole(world.id, viewerId) : null;
    const canEdit =
      viewerId != null && canReviewWorks({ world, role, userId: viewerId });
    const [entries, timeline, collections, pages] = await Promise.all([
      listEntries(world.id),
      listTimeline(world.id),
      listCollections(world.id, { includeHidden: isOwner }),
      listWorldPages(world.id, { includeDrafts: canEdit }),
    ]);

    return {
      world: toPublicWorld(world),
      entries: entries.map(toPublicEntry),
      timeline: timeline.map(toPublicTimeline),
      collections: collections.map(toPublicCollection),
      pages: pages.map(toPublicWorldPage),
      isOwner,
      canEdit,
    };
  });

  app.get("/api/worlds/:slug", async (req, reply) => {
    const { slug } = req.params as { slug: string };
    const world = await findWorldBySlug(slug);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const viewerId = req.authUser?.id ?? null;
    if (!canViewWorld(world, viewerId)) {
      return reply.code(404).send({ error: "world not found" });
    }

    const isOwner = viewerId != null && isWorldCreator(world, viewerId);
    const role = viewerId ? await getMemberRole(world.id, viewerId) : null;
    const canEdit =
      viewerId != null && canReviewWorks({ world, role, userId: viewerId });
    const [entries, timeline, collections, pages] = await Promise.all([
      listEntries(world.id),
      listTimeline(world.id),
      listCollections(world.id, { includeHidden: isOwner }),
      listWorldPages(world.id, { includeDrafts: canEdit }),
    ]);

    return {
      world: toPublicWorld(world),
      entries: entries.map(toPublicEntry),
      timeline: timeline.map(toPublicTimeline),
      collections: collections.map(toPublicCollection),
      pages: pages.map(toPublicWorldPage),
      isOwner,
      canEdit,
    };
  });

  app.patch("/api/worlds/:id", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name);
    if (name !== undefined && !name.trim()) {
      return reply.code(400).send({ error: "name cannot be empty" });
    }

    const homepageConfig =
      body.homepageConfig !== undefined
        ? normalizeHomepageConfig(body.homepageConfig)
        : undefined;

    const layout =
      body.layout !== undefined ? normalizeWorldLayout(body.layout) : undefined;

    let workSubmitMode: WorkSubmitMode | undefined;
    if (typeof body.workSubmitMode === "string") {
      if (!(WORK_SUBMIT_MODES as readonly string[]).includes(body.workSubmitMode)) {
        return reply.code(400).send({ error: "invalid workSubmitMode" });
      }
      workSubmitMode = body.workSubmitMode as WorkSubmitMode;
    }

    const updated = await updateWorld(id, {
      name: name?.trim().slice(0, 80),
      tagline: asString(body.tagline)?.slice(0, 140),
      description: asString(body.description)?.slice(0, 500),
      logoUrl: asNullableString(body.logoUrl),
      wikiBackgroundUrl: asNullableString(body.wikiBackgroundUrl),
      coverUrl: asNullableString(body.coverUrl),
      tags: asStringArray(body.tags),
      welcomeMessage: asNullableString(body.welcomeMessage),
      homepageConfig,
      layout,
      workSubmitMode,
    });

    return { world: toPublicWorld(updated!) };
  });

  app.post("/api/worlds/:id/publish", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    if (!world.name.trim()) {
      return reply.code(400).send({ error: "name is required before publish" });
    }

    const published = await publishWorld(id);
    return { world: toPublicWorld(published!) };
  });

  app.delete("/api/worlds/:id", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    await softDeleteWorld(id);
    return reply.code(204).send();
  });

  // —— Collections (归属) ——
  app.get("/api/worlds/:id/collections", async (req, reply) => {
    const { id } = req.params as { id: string };
    const world = await findWorldById(id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const viewerId = req.authUser?.id ?? null;
    if (!canViewWorld(world, viewerId)) {
      return reply.code(404).send({ error: "world not found" });
    }
    const isOwner = viewerId != null && isWorldCreator(world, viewerId);
    const rows = await listCollections(id, { includeHidden: isOwner });
    return { collections: rows.map(toPublicCollection) };
  });

  app.post("/api/worlds/:id/collections", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const name = asString(body.name)?.trim() ?? "";
    if (!name) {
      return reply.code(400).send({ error: "name is required" });
    }
    const created = await createCollection({
      worldId: id,
      name,
      key: asString(body.key),
      iconUrl: asNullableString(body.iconUrl) ?? null,
      color: asNullableString(body.color) ?? null,
      attrFields: sanitizeAttrFields(body.attrFields),
    });
    return reply.code(201).send({ collection: toPublicCollection(created) });
  });

  app.patch("/api/worlds/:id/collections/:collectionId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, collectionId } = req.params as {
      id: string;
      collectionId: string;
    };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Parameters<typeof updateCollection>[2] = {};
    if (body.name !== undefined) {
      const name = asString(body.name)?.trim() ?? "";
      if (!name) {
        return reply.code(400).send({ error: "name cannot be empty" });
      }
      patch.name = name;
    }
    if (body.iconUrl !== undefined) {
      patch.iconUrl = asNullableString(body.iconUrl) ?? null;
    }
    if (body.color !== undefined) {
      patch.color = asNullableString(body.color) ?? null;
    }
    if (body.attrFields !== undefined) {
      patch.attrFields = sanitizeAttrFields(body.attrFields);
    }
    if (typeof body.sortOrder === "number") {
      patch.sortOrder = body.sortOrder;
    }
    if (typeof body.hidden === "boolean") {
      patch.hidden = body.hidden;
    }

    const updated = await updateCollection(collectionId, id, patch);
    if (!updated) {
      return reply.code(404).send({ error: "collection not found" });
    }
    return { collection: toPublicCollection(updated) };
  });

  app.delete("/api/worlds/:id/collections/:collectionId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, collectionId } = req.params as {
      id: string;
      collectionId: string;
    };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }
    const result = await deleteCollection(collectionId, id);
    if (!result.ok) {
      const errors: Record<string, [number, string]> = {
        not_found: [404, "collection not found"],
        builtin: [400, "内置归属不可删除，可改为隐藏"],
        has_entries: [400, "该归属下仍有词条，请先转移或删除"],
      };
      const [code, message] = errors[result.reason];
      return reply.code(code).send({ error: message });
    }
    return reply.code(204).send();
  });

  // —— Pages (Wiki 界面) ——
  app.get("/api/worlds/:id/pages", async (req, reply) => {
    const { id } = req.params as { id: string };
    const world = await findWorldById(id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const viewerId = req.authUser?.id ?? null;
    if (!canViewWorld(world, viewerId)) {
      return reply.code(404).send({ error: "world not found" });
    }
    const isOwner = viewerId != null && isWorldCreator(world, viewerId);
    const role = viewerId ? await getMemberRole(world.id, viewerId) : null;
    const canEdit =
      viewerId != null && canReviewWorks({ world, role, userId: viewerId });
    const rows = await listWorldPages(id, { includeDrafts: canEdit });
    return { pages: rows.map(toPublicWorldPage), isOwner, canEdit };
  });

  app.post("/api/worlds/:id/pages", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const kind =
      typeof body.kind === "string" &&
      (PAGE_KINDS as readonly string[]).includes(body.kind)
        ? (body.kind as PageKind)
        : "custom";
    if (kind === "home") {
      const existing = await listWorldPages(id);
      if (existing.some((p) => p.kind === "home")) {
        return reply.code(409).send({ error: "home page already exists" });
      }
    }
    const created = await createWorldPage({
      worldId: id,
      kind,
      collectionKey: asString(body.collectionKey) ?? null,
      title: asString(body.title) ?? "",
      slug: asString(body.slug) ?? "",
      layout: body.layout as WorldLayout | undefined,
      css: asString(body.css) ?? "",
      status: "published",
      sortOrder: typeof body.sortOrder === "number" ? body.sortOrder : 0,
    });
    return reply.code(201).send({ page: toPublicWorldPage(created) });
  });

  app.patch("/api/worlds/:id/pages/:pageId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, pageId } = req.params as { id: string; pageId: string };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }
    const body = (req.body ?? {}) as Record<string, unknown>;
    const patch: Parameters<typeof updateWorldPage>[2] = {};
    if (body.title !== undefined) patch.title = asString(body.title) ?? "";
    if (body.slug !== undefined) patch.slug = asString(body.slug) ?? "";
    if (body.css !== undefined) patch.css = asString(body.css) ?? "";
    if (body.status === "draft" || body.status === "published") {
      patch.status = body.status;
    }
    if (typeof body.sortOrder === "number") patch.sortOrder = body.sortOrder;
    if (body.layout !== undefined) {
      patch.layout = body.layout as WorldLayout;
    }
    const updated = await updateWorldPage(pageId, id, patch);
    if (!updated) {
      return reply.code(404).send({ error: "page not found" });
    }
    return { page: toPublicWorldPage(updated) };
  });

  app.delete("/api/worlds/:id/pages/:pageId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, pageId } = req.params as { id: string; pageId: string };
    const world = await loadManageableWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found or no permission" });
    }
    const ok = await softDeleteWorldPage(pageId, id);
    if (!ok) {
      return reply
        .code(400)
        .send({ error: "page not found or home page cannot be deleted" });
    }
    return reply.code(204).send();
  });

  // —— Entries ——
  app.get("/api/worlds/:id/entries", async (req, reply) => {
    const { id } = req.params as { id: string };
    const world = await findWorldById(id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const viewerId = req.authUser?.id ?? null;
    if (!canViewWorld(world, viewerId)) {
      return reply.code(404).send({ error: "world not found" });
    }
    const q = req.query as { category?: string };
    const category =
      typeof q.category === "string" && q.category ? q.category : undefined;
    const rows = await listEntries(id, category);
    return { entries: rows.map(toPublicEntry) };
  });

  app.post("/api/worlds/:id/entries", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const category = asString(body.category) ?? "";
    const title = asString(body.title)?.trim() ?? "";
    if (!(await isValidCategory(id, category))) {
      return reply.code(400).send({ error: "invalid category" });
    }
    if (!title) {
      return reply.code(400).send({ error: "title is required" });
    }

    const entry = await createEntry({
      worldId: id,
      category,
      title,
      content: asString(body.content) ?? "",
      contentLayout: body.contentLayout,
      imageUrl: asNullableString(body.imageUrl) ?? null,
      attributes: asRecord(body.attributes),
      userId: user.id,
    });
    return reply.code(201).send({ entry: toPublicEntry(entry) });
  });

  app.patch("/api/worlds/:id/entries/:entryId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, entryId } = req.params as { id: string; entryId: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const existing = await findEntryById(entryId);
    if (!existing || existing.world_id !== id) {
      return reply.code(404).send({ error: "entry not found" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title)?.trim();
    if (title !== undefined && !title) {
      return reply.code(400).send({ error: "title cannot be empty" });
    }

    let category: string | undefined;
    if (typeof body.category === "string") {
      if (!(await isValidCategory(id, body.category))) {
        return reply.code(400).send({ error: "invalid category" });
      }
      category = body.category;
    }

    const entry = await updateEntry(entryId, user.id, {
      title,
      category,
      content: asString(body.content),
      contentLayout:
        body.contentLayout !== undefined ? body.contentLayout : undefined,
      imageUrl: asNullableString(body.imageUrl),
      attributes: asRecord(body.attributes),
    });
    return { entry: toPublicEntry(entry!) };
  });

  app.delete("/api/worlds/:id/entries/:entryId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, entryId } = req.params as { id: string; entryId: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const existing = await findEntryById(entryId);
    if (!existing || existing.world_id !== id) {
      return reply.code(404).send({ error: "entry not found" });
    }
    if (existing.category === "intro") {
      return reply.code(400).send({ error: "cannot delete intro entry" });
    }
    await softDeleteEntry(entryId);
    return reply.code(204).send();
  });

  // —— Timeline ——
  app.get("/api/worlds/:id/timeline", async (req, reply) => {
    const { id } = req.params as { id: string };
    const world = await findWorldById(id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const viewerId = req.authUser?.id ?? null;
    if (!canViewWorld(world, viewerId)) {
      return reply.code(404).send({ error: "world not found" });
    }
    const rows = await listTimeline(id);
    return { timeline: rows.map(toPublicTimeline) };
  });

  app.post("/api/worlds/:id/timeline", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id } = req.params as { id: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title)?.trim() ?? "";
    if (!title) {
      return reply.code(400).send({ error: "title is required" });
    }

    const event = await createTimelineEvent({
      worldId: id,
      title,
      description: asString(body.description) ?? "",
      eventDate: asString(body.eventDate) ?? "",
      userId: user.id,
    });
    return reply.code(201).send({ event: toPublicTimeline(event) });
  });

  app.patch("/api/worlds/:id/timeline/:eventId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, eventId } = req.params as { id: string; eventId: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const existing = await findTimelineEvent(eventId);
    if (!existing || existing.world_id !== id) {
      return reply.code(404).send({ error: "event not found" });
    }

    const body = (req.body ?? {}) as Record<string, unknown>;
    const title = asString(body.title)?.trim();
    if (title !== undefined && !title) {
      return reply.code(400).send({ error: "title cannot be empty" });
    }

    const sortOrder =
      typeof body.sortOrder === "number" ? body.sortOrder : undefined;

    const event = await updateTimelineEvent(eventId, {
      title,
      description: asString(body.description),
      eventDate: asString(body.eventDate),
      sortOrder,
    });
    return { event: toPublicTimeline(event!) };
  });

  app.delete("/api/worlds/:id/timeline/:eventId", async (req, reply) => {
    const user = await requireAuth(req, reply);
    if (!user) return;
    const { id, eventId } = req.params as { id: string; eventId: string };
    const world = await loadOwnedWorld(id, user.id);
    if (!world) {
      return reply.code(404).send({ error: "world not found" });
    }
    const existing = await findTimelineEvent(eventId);
    if (!existing || existing.world_id !== id) {
      return reply.code(404).send({ error: "event not found" });
    }
    await deleteTimelineEvent(eventId);
    return reply.code(204).send();
  });
}
