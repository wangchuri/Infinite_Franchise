/**
 * World page layout (v2): author-composed, platform-rendered blocks.
 *
 * The platform owns the renderer + component library; authors compose a JSON
 * layout of whitelisted blocks. No arbitrary CSS/HTML is stored or rendered.
 *
 * Mirrors frontend/src/lib/world-layout.ts — keep the two files in sync.
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
  "navGrid",
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
  // author-authored HTML (rendered in a sandboxed iframe with world data)
  "customHtml",
  // content blocks (entry bodies + world pages)
  "heading",
  "text",
  "image",
  "gallery",
  "quote",
  "button",
  "linkList",
  "relatedEntries",
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

export type ComponentFieldType = "text" | "image" | "color" | "font";

export type ComponentField = {
  key: string;
  label: string;
  type: ComponentFieldType;
  default?: string;
};

export type VariantMatchOp = "eq" | "neq" | "contains";

/** Condition on an entry attribute (used to pick a card variant). */
export type VariantMatch = {
  field: string;
  op: VariantMatchOp;
  value: string;
};

/** Built-in presentation of a card variant (overridable by author CSS). */
export type VariantBox = {
  width?: string;
  height?: string;
  bgImage?: string;
  bgColor?: string;
  radius?: string;
  opacity?: number;
};

/**
 * A card variant for a region: how each item in the region is rendered.
 * Regions may define several; the first whose `match` passes wins, else the
 * default variant. `html`/`css` are the advanced template ({{key}} tokens).
 */
export type BlockVariant = {
  id: string;
  name: string;
  isDefault?: boolean;
  match: VariantMatch | null;
  fields: ComponentField[];
  values: Record<string, string>;
  html: string;
  css: string;
  /** Fallback image when an item has none ({{imageUrl}}). */
  defaultImage?: string;
  /** Built-in box settings; page/variant CSS override these. */
  box?: VariantBox;
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
    if (k === "variants") {
      const variants = sanitizeVariants(v);
      if (variants) out[k] = variants;
      continue;
    }
    if (typeof v === "string") out[k] = v.slice(0, 20000);
    else if (typeof v === "number" || typeof v === "boolean") out[k] = v;
    else if (Array.isArray(v)) {
      out[k] = v.filter((x) => typeof x === "string").slice(0, 50);
    } else if (v && typeof v === "object") {
      // shallow string map (e.g. component instance values)
      const map: Record<string, string> = {};
      let n = 0;
      for (const [mk, mv] of Object.entries(v as Record<string, unknown>)) {
        if (n >= 60) break;
        if (typeof mv === "string") {
          map[mk.slice(0, 40)] = mv.slice(0, 20000);
          n += 1;
        }
      }
      if (Object.keys(map).length) out[k] = map;
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

const COMPONENT_FIELD_TYPES = new Set<ComponentFieldType>([
  "text",
  "image",
  "color",
  "font",
]);
const VARIANT_MATCH_OPS = new Set<VariantMatchOp>(["eq", "neq", "contains"]);
const MAX_VARIANTS = 12;
const MAX_COMPONENT_FIELDS = 12;

/** A single CSS length/keyword; reject anything that could break the rule. */
function sanitizeCssValue(raw: unknown): string | undefined {
  if (typeof raw !== "string") return undefined;
  const value = raw.trim().slice(0, 40);
  if (!value || /[;{}<>]/.test(value)) return undefined;
  return value;
}

function sanitizeVariantBox(raw: unknown): VariantBox | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const s = raw as Record<string, unknown>;
  const box: VariantBox = {};
  const width = sanitizeCssValue(s.width);
  if (width) box.width = width;
  const height = sanitizeCssValue(s.height);
  if (height) box.height = height;
  const radius = sanitizeCssValue(s.radius);
  if (radius) box.radius = radius;
  if (typeof s.bgImage === "string" && s.bgImage) {
    box.bgImage = s.bgImage.slice(0, 2000);
  }
  if (typeof s.bgColor === "string" && /^#[0-9A-Fa-f]{3,8}$/.test(s.bgColor)) {
    box.bgColor = s.bgColor;
  }
  if (typeof s.opacity === "number" && s.opacity >= 0 && s.opacity <= 1) {
    box.opacity = s.opacity;
  }
  return Object.keys(box).length ? box : undefined;
}

function sanitizeComponentField(raw: unknown): ComponentField | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  const key =
    typeof s.key === "string" ? s.key.replace(/[^\w-]/g, "").slice(0, 40) : "";
  if (!key) return null;
  const label =
    typeof s.label === "string" && s.label.trim() ? s.label.slice(0, 40) : key;
  const type =
    typeof s.type === "string" &&
    COMPONENT_FIELD_TYPES.has(s.type as ComponentFieldType)
      ? (s.type as ComponentFieldType)
      : "text";
  const def =
    typeof s.default === "string" ? s.default.slice(0, 20000) : undefined;
  const field: ComponentField = { key, label, type };
  if (def !== undefined) field.default = def;
  return field;
}

function sanitizeVariantMatch(raw: unknown): VariantMatch | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  const field =
    typeof s.field === "string"
      ? s.field.replace(/[^\w.-]/g, "").slice(0, 40)
      : "";
  if (!field) return null;
  const op =
    typeof s.op === "string" && VARIANT_MATCH_OPS.has(s.op as VariantMatchOp)
      ? (s.op as VariantMatchOp)
      : "eq";
  const value = typeof s.value === "string" ? s.value.slice(0, 200) : "";
  return { field, op, value };
}

function sanitizeVariant(
  raw: unknown,
  seed: { n: number },
): BlockVariant | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const s = raw as Record<string, unknown>;
  const id =
    typeof s.id === "string" && s.id.trim()
      ? s.id.slice(0, 80)
      : `variant-${seed.n++}`;
  const name =
    typeof s.name === "string" && s.name.trim()
      ? s.name.slice(0, 60)
      : "未命名卡片";
  const isDefault = s.isDefault === true;
  const match = isDefault ? null : sanitizeVariantMatch(s.match);
  const fields = Array.isArray(s.fields)
    ? s.fields
        .map(sanitizeComponentField)
        .filter((f): f is ComponentField => f !== null)
        .slice(0, MAX_COMPONENT_FIELDS)
    : [];

  const values: Record<string, string> = {};
  if (s.values && typeof s.values === "object" && !Array.isArray(s.values)) {
    let n = 0;
    for (const [vk, vv] of Object.entries(s.values as Record<string, unknown>)) {
      if (n >= 60) break;
      if (typeof vv === "string") {
        values[vk.slice(0, 40)] = vv.slice(0, 20000);
        n += 1;
      }
    }
  }

  const variant: BlockVariant = {
    id,
    name,
    match,
    fields,
    values,
    html: typeof s.html === "string" ? s.html.slice(0, 20000) : "",
    css: typeof s.css === "string" ? s.css.slice(0, 20000) : "",
  };
  if (isDefault) variant.isDefault = true;
  if (typeof s.defaultImage === "string" && s.defaultImage) {
    variant.defaultImage = s.defaultImage.slice(0, 2000);
  }
  const box = sanitizeVariantBox(s.box);
  if (box) variant.box = box;
  return variant;
}

function sanitizeVariants(raw: unknown): BlockVariant[] | undefined {
  if (!Array.isArray(raw)) return undefined;
  const seed = { n: 0 };
  const out = raw
    .map((v) => sanitizeVariant(v, seed))
    .filter((v): v is BlockVariant => v !== null)
    .slice(0, MAX_VARIANTS);
  return out.length ? out : undefined;
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

/** Blocks allowed inside an entry body (flat list, no slots). */
export const CONTENT_BLOCK_TYPES = [
  "heading",
  "text",
  "image",
  "gallery",
  "quote",
  "divider",
  "button",
  "linkList",
  "relatedEntries",
  "customHtml",
] as const;

const CONTENT_BLOCK_SET = new Set<string>(CONTENT_BLOCK_TYPES);

/** Entry page column mode: `two` shows the info card sidebar. */
export type EntryLayoutMode = "one" | "two";
export type EntryLayout = WorldLayout & { mode: EntryLayoutMode };

/** Normalize an entry body layout: content blocks only, no nesting. */
export function normalizeEntryLayout(raw: unknown): EntryLayout {
  const layout = normalizeWorldLayout(raw);
  const blocks = layout.blocks.filter(
    (b) => CONTENT_BLOCK_SET.has(b.type) && !b.slots,
  );
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const mode: EntryLayoutMode = src.mode === "one" ? "one" : "two";
  return { version: 2, blocks, mode };
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
