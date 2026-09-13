/**
 * World page layout (v2): author-composed, platform-rendered blocks.
 *
 * The platform owns the renderer + component library; authors compose a JSON
 * layout of whitelisted blocks. No arbitrary CSS/HTML is stored or rendered.
 *
 * Mirrors backend/src/config/world-layout.ts — keep the two files in sync.
 */

export const BLOCK_TYPES = [
  // chrome / scaffolding
  "topBar",
  "hero",
  "columns",
  "section",
  "divider",
  "spacer",
  "footer",
  // data regions (auto-filled from the world's data)
  "nav",
  "prose",
  "entryGrid",
  "glossary",
  "timeline",
  "eventAxis",
  "workList",
  "infoBox",
  "stats",
  "tagCloud",
  // platform affordances
  "platformButton",
  // reserved static content (later phases)
  "heading",
  "image",
  "gallery",
  "quote",
  "button",
  "linkList",
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export type Block = {
  id: string;
  type: BlockType;
  props?: Record<string, unknown>;
  slots?: Record<string, Block[]>;
};

export type LayoutTheme = {
  accent?: string;
  serif?: boolean;
  density?: "compact" | "normal" | "loose";
};

export type WorldLayout = {
  version: 2;
  blocks: Block[];
  theme?: LayoutTheme;
};

export const EMPTY_LAYOUT: WorldLayout = { version: 2, blocks: [] };

const BLOCK_TYPE_SET = new Set<string>(BLOCK_TYPES);
const ANCHOR_BLOCK_TYPES = new Set<string>([
  "prose",
  "entryGrid",
  "glossary",
  "timeline",
  "eventAxis",
  "workList",
]);
const DEFAULT_SECTION_LABEL: Record<string, string> = {
  prose: "世界介绍",
  entryGrid: "条目",
  glossary: "概念",
  timeline: "时间轴",
  eventAxis: "事件轴",
  workList: "作品",
};

const MAX_BLOCKS = 240;
const MAX_DEPTH = 3;
const MAX_SLOTS = 4;

const LEGACY_DEFAULT_MODULES = [
  "intro",
  "characters",
  "locations",
  "organizations",
  "concepts",
  "items",
  "timeline",
  "works",
];

/** v1 module → v2 block template (used by the legacy adapter). */
const LEGACY_MODULE_BLOCK: Record<
  string,
  { type: BlockType; props?: Record<string, unknown> }
> = {
  intro: {
    type: "prose",
    props: { source: "intro", title: "世界介绍" },
  },
  characters: {
    type: "entryGrid",
    props: { category: "character", title: "人物", withImage: true },
  },
  locations: {
    type: "entryGrid",
    props: { category: "location", title: "地点" },
  },
  organizations: {
    type: "entryGrid",
    props: { category: "organization", title: "势力" },
  },
  concepts: {
    type: "glossary",
    props: { category: "concept", title: "概念" },
  },
  items: {
    type: "entryGrid",
    props: { category: "item", title: "物品", withImage: true },
  },
  timeline: { type: "timeline", props: { title: "时间轴" } },
  works: { type: "workList", props: { title: "作品" } },
};

export type LayoutSection = {
  id: string;
  label: string;
  type: BlockType;
  category?: string;
};

export function isBlockType(value: unknown): value is BlockType {
  return typeof value === "string" && BLOCK_TYPE_SET.has(value);
}

function sanitizeProps(raw: unknown): Record<string, unknown> | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") out[k] = v.slice(0, 500);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) {
      out[k] = v.filter((x) => typeof x === "string").slice(0, 50);
    }
  }
  return Object.keys(out).length ? out : undefined;
}

function sanitizeBlock(
  raw: unknown,
  depth: number,
  seed: { n: number },
): Block | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const src = raw as Record<string, unknown>;
  if (!isBlockType(src.type)) return null;
  const id =
    typeof src.id === "string" && src.id.trim()
      ? src.id.slice(0, 80)
      : `${src.type}-${seed.n++}`;
  const props = sanitizeProps(src.props);

  let slots: Record<string, Block[]> | undefined;
  if (
    depth < MAX_DEPTH &&
    src.slots &&
    typeof src.slots === "object" &&
    !Array.isArray(src.slots)
  ) {
    const out: Record<string, Block[]> = {};
    let slotCount = 0;
    for (const [key, value] of Object.entries(
      src.slots as Record<string, unknown>,
    )) {
      if (slotCount >= MAX_SLOTS || !Array.isArray(value)) continue;
      const arr = value
        .map((b) => sanitizeBlock(b, depth + 1, seed))
        .filter((b): b is Block => b !== null);
      if (arr.length) {
        out[key] = arr;
        slotCount += 1;
      }
    }
    if (Object.keys(out).length) slots = out;
  }

  const block: Block = { id, type: src.type };
  if (props) block.props = props;
  if (slots) block.slots = slots;
  return block;
}

function sanitizeTheme(raw: unknown): LayoutTheme | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const src = raw as Record<string, unknown>;
  const theme: LayoutTheme = {};
  if (typeof src.accent === "string" && /^#[0-9A-Fa-f]{6}$/.test(src.accent)) {
    theme.accent = src.accent;
  }
  if (typeof src.serif === "boolean") theme.serif = src.serif;
  if (
    src.density === "compact" ||
    src.density === "normal" ||
    src.density === "loose"
  ) {
    theme.density = src.density;
  }
  return Object.keys(theme).length ? theme : undefined;
}

/** Build the default 3-column wiki preset from an ordered module list. */
export function buildDefaultLayout(modules?: string[]): WorldLayout {
  const ordered = (modules && modules.length ? modules : LEGACY_DEFAULT_MODULES)
    .filter((m) => LEGACY_MODULE_BLOCK[m]);
  const picked = ordered.length ? ordered : LEGACY_DEFAULT_MODULES;

  const main: Block[] = picked.map((m, i) => {
    const def = LEGACY_MODULE_BLOCK[m];
    const block: Block = { id: `main-${m}-${i}`, type: def.type };
    if (def.props) block.props = { ...def.props };
    return block;
  });

  return {
    version: 2,
    blocks: [
      { id: "topbar", type: "topBar" },
      { id: "hero", type: "hero", props: { showTags: true } },
      {
        id: "columns",
        type: "columns",
        props: { ratio: "224:1fr:300" },
        slots: {
          left: [{ id: "nav", type: "nav" }],
          main,
          right: [{ id: "infobox", type: "infoBox" }],
        },
      },
      {
        id: "footer",
        type: "footer",
        props: { platformButton: true },
      },
    ],
  };
}

function presetFromLegacy(raw: Record<string, unknown>): WorldLayout {
  const modules = Array.isArray(raw.modules)
    ? raw.modules.filter((m): m is string => typeof m === "string")
    : undefined;
  const layout = buildDefaultLayout(modules);
  const theme = sanitizeTheme({
    accent: raw.accent,
    serif: true,
  });
  if (theme) layout.theme = theme;
  return layout;
}

/** Accepts v2 layouts, legacy v1 homepage configs, or `{}`. */
export function normalizeWorldLayout(raw: unknown): WorldLayout {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  if (src.version === 2 || Array.isArray(src.blocks)) {
    const seed = { n: 0 };
    const blocks = Array.isArray(src.blocks)
      ? src.blocks
          .map((b) => sanitizeBlock(b, 0, seed))
          .filter((b): b is Block => b !== null)
          .slice(0, MAX_BLOCKS)
      : [];
    const layout: WorldLayout = { version: 2, blocks };
    const theme = sanitizeTheme(src.theme);
    if (theme) layout.theme = theme;
    return layout;
  }

  return presetFromLegacy(src);
}

/** Anchor sections (for nav / table of contents), in document order. */
export function collectSections(blocks: Block[]): LayoutSection[] {
  const out: LayoutSection[] = [];
  const walk = (list: Block[]) => {
    for (const block of list) {
      if (ANCHOR_BLOCK_TYPES.has(block.type)) {
        const title = block.props?.title;
        const label =
          typeof title === "string" && title.trim()
            ? title
            : (DEFAULT_SECTION_LABEL[block.type] ?? block.type);
        const category =
          typeof block.props?.category === "string"
            ? block.props.category
            : undefined;
        out.push({
          id: block.id,
          label,
          type: block.type,
          ...(category ? { category } : {}),
        });
      }
      if (block.slots) {
        for (const children of Object.values(block.slots)) walk(children);
      }
    }
  };
  walk(blocks);
  return out;
}
