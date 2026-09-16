import type { Work } from "@/lib/works";
import type { WorldCollection } from "@/lib/collections";
import type { TimelineEvent, WikiEntry, World } from "@/lib/worlds";

/** Prevent injected JSON from closing the wrapping <script> tag. */
export function safeJson(value: unknown): string {
  return JSON.stringify(value)
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

export type WorldDataContext = {
  world: World;
  entries: WikiEntry[];
  byCategory: Record<string, WikiEntry[]>;
  timeline: TimelineEvent[];
  works: Work[];
  collections?: WorldCollection[];
};

/** Shape injected into every sandboxed author frame as `window.WORLD`. */
export function buildWorldData(ctx: WorldDataContext) {
  const slimEntry = (e: WikiEntry) => ({
    id: e.id,
    category: e.category,
    title: e.title,
    slug: e.slug,
    aliases: e.aliases ?? [],
    content: e.content,
    imageUrl: e.imageUrl,
    attributes: e.attributes ?? {},
  });

  return {
    world: {
      id: ctx.world.id,
      name: ctx.world.name,
      slug: ctx.world.slug,
      tagline: ctx.world.tagline,
      description: ctx.world.description,
      tags: ctx.world.tags,
      logoUrl: ctx.world.logoUrl,
      coverUrl: ctx.world.coverUrl,
      wikiBackgroundUrl: ctx.world.wikiBackgroundUrl,
    },
    entries: ctx.entries.map(slimEntry),
    categories: Object.fromEntries(
      Object.entries(ctx.byCategory).map(([k, list]) => [
        k,
        list.map(slimEntry),
      ]),
    ),
    collections: (ctx.collections ?? []).map((c: WorldCollection) => ({
      key: c.key,
      name: c.name,
      iconUrl: c.iconUrl,
      color: c.color,
      attrFields: c.attrFields,
    })),
    timeline: ctx.timeline.map((t) => ({
      id: t.id,
      title: t.title,
      description: t.description,
      eventDate: t.eventDate,
    })),
    works: ctx.works.map((w) => ({
      id: w.id,
      title: w.title,
      summary: w.summary,
      category: w.category,
      kind: w.kind,
      worldSlug: w.worldSlug,
      authorDisplayName: w.authorDisplayName,
    })),
  };
}

export const SANDBOX =
  "allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms";
