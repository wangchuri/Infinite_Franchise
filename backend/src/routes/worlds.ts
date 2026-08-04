import type { FastifyInstance } from "fastify";
import { requireAuth } from "../auth-guard.js";
import { normalizeHomepageConfig } from "../homepage-config.js";
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
} from "../worlds.js";
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
} from "../wiki.js";

const ENTRY_CATEGORIES = new Set([
  "intro",
  "character",
  "location",
  "item",
  "organization",
  "event",
  "concept",
  "other",
]);

function asString(v: unknown): string | undefined {
  return typeof v === "string" ? v : undefined;
}

function asNullableString(v: unknown): string | null | undefined {
  if (v === null) return null;
  if (typeof v === "string") return v;
  return undefined;
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

    const [entries, timeline] = await Promise.all([
      listEntries(world.id),
      listTimeline(world.id),
    ]);

    return {
      world: toPublicWorld(world),
      entries: entries.map(toPublicEntry),
      timeline: timeline.map(toPublicTimeline),
      isOwner: viewerId != null && isWorldCreator(world, viewerId),
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

    const [entries, timeline] = await Promise.all([
      listEntries(world.id),
      listTimeline(world.id),
    ]);

    return {
      world: toPublicWorld(world),
      entries: entries.map(toPublicEntry),
      timeline: timeline.map(toPublicTimeline),
      isOwner: viewerId != null && isWorldCreator(world, viewerId),
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

    const updated = await updateWorld(id, {
      name: name?.trim().slice(0, 80),
      description: asString(body.description)?.slice(0, 500),
      logoUrl: asNullableString(body.logoUrl),
      wikiBackgroundUrl: asNullableString(body.wikiBackgroundUrl),
      coverUrl: asNullableString(body.coverUrl),
      tags: asStringArray(body.tags),
      welcomeMessage: asNullableString(body.welcomeMessage),
      homepageConfig,
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
      typeof q.category === "string" && ENTRY_CATEGORIES.has(q.category)
        ? q.category
        : undefined;
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
    if (!ENTRY_CATEGORIES.has(category) || category === "intro") {
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
      imageUrl: asNullableString(body.imageUrl) ?? null,
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

    const entry = await updateEntry(entryId, user.id, {
      title,
      content: asString(body.content),
      imageUrl: asNullableString(body.imageUrl),
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
