/**
 * Example data for the wiki layout editor preview, so authors can see how
 * each region looks before their world has real content.
 */
import type { TimelineEvent, WikiEntry } from "./worlds";
import type { WorldCollection } from "./collections";
import type { EntryLayout } from "./world-layout";
import type { Work } from "./works";

const NOW = "2026-01-01T00:00:00.000Z";
const EMPTY_LAYOUT: EntryLayout = { version: 2, mode: "two", blocks: [] };

/** Built-in collections for the layout editor preview (no real world yet). */
export function sampleCollections(): WorldCollection[] {
  const col = (
    key: string,
    name: string,
    sortOrder: number,
    attrFields: { key: string; label: string }[] = [],
  ): WorldCollection => ({
    id: `sample-col-${key}`,
    key,
    name,
    iconUrl: null,
    color: null,
    attrFields,
    sortOrder,
    hidden: false,
    isBuiltin: true,
  });
  return [
    col("character", "人物", 0, [
      { key: "role", label: "身份" },
      { key: "affiliation", label: "所属" },
    ]),
    col("location", "地点", 1),
    col("item", "物品", 2),
    col("organization", "组织", 3),
    col("event", "事件", 4),
    col("concept", "概念", 5),
    col("other", "其他", 6),
  ];
}

function entry(
  worldId: string,
  id: string,
  category: string,
  title: string,
  content: string,
  attributes: Record<string, string> = {},
  contentLayout: EntryLayout = EMPTY_LAYOUT,
): WikiEntry {
  return {
    id: `sample-${id}`,
    worldId,
    category,
    title,
    slug: id,
    aliases: [],
    content,
    contentLayout,
    imageUrl: null,
    attributes,
    status: "published",
    version: 1,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

export function sampleEntries(worldId: string): WikiEntry[] {
  const linaLayout: EntryLayout = {
    version: 2,
    mode: "two",
    blocks: [
      { id: "b-heading", type: "heading", props: { text: "神会的少女", level: "2" } },
      {
        id: "b-text",
        type: "text",
        props: {
          markdown:
            "李和园在**电池宇宙**中醒来，手持[[指针]]。\n\n她以为[[神会]]只是「世界根源研究组织」。",
        },
      },
      {
        id: "b-related",
        type: "relatedEntries",
        props: {
          title: "相关词条",
          slugs: ["wang", "pointer", "shenhui"],
          columns: "3",
        },
      },
    ],
  };
  return [
    entry(worldId, "lina", "character", "李和园", "误入神会的少女，持有原物质指针。", { role: "主角", affiliation: "神会" }, linaLayout),
    entry(worldId, "wang", "character", "王出日", "神会的技术负责人，缇娜的命名者。", { role: "NPC", affiliation: "神会" }),
    entry(worldId, "battery", "location", "电池宇宙", "由原物质编织出的封闭宇宙。"),
    entry(worldId, "root", "concept", "原物质", "指向每一个世界的「指针」。"),
    entry(worldId, "pointer", "item", "指针", "定位原物质坐标的装置。"),
    entry(worldId, "shenhui", "organization", "神会", "自称世界根源研究组织。"),
  ];
}

export function sampleTimeline(worldId: string): TimelineEvent[] {
  const ev = (id: string, title: string, description: string, eventDate: string, sortOrder: number): TimelineEvent => ({
    id: `sample-tl-${id}`,
    worldId,
    title,
    description,
    eventDate,
    sortOrder,
    createdAt: NOW,
    updatedAt: NOW,
  });
  return [
    ev("1", "原点", "清玲之歌写下第一个世界。", "纪元前", 0),
    ev("2", "电池宇宙", "原物质首次被封装成宇宙。", "纪元 0", 1),
    ev("3", "神会成立", "研究组织在缝隙中成立。", "纪元 12", 2),
  ];
}

export function sampleWorks(world: { id: string; name: string; slug: string }): Work[] {
  const base = {
    worldId: world.id,
    worldName: world.name,
    worldSlug: world.slug,
    authorId: "sample-author",
    authorUsername: "demo",
    authorDisplayName: "示例作者",
    status: "published",
    parentId: null,
    content: null,
    mediaUrl: null,
    reactionCounts: {},
    publishedAt: NOW,
    createdAt: NOW,
    updatedAt: NOW,
  };
  return [
    {
      ...base,
      id: "sample-work-1",
      type: "story",
      category: "novel",
      kind: "short",
      title: "清玲之歌",
      summary: "起源篇：一本书写下的世界，和一个叫柳无的名字。",
    },
    {
      ...base,
      id: "sample-work-2",
      type: "story",
      category: "novel",
      kind: "short",
      title: "OtherMe",
      summary: "主线：电池宇宙里，两个自己对抗神会。",
    },
    {
      ...base,
      id: "sample-work-3",
      type: "artwork",
      category: "artwork",
      kind: "illustration",
      title: "神会徽记",
      summary: "神会的标志设定图。",
    },
  ];
}
