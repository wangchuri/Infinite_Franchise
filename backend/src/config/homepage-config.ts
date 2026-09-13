/** Shared Wiki homepage style config (stored in worlds.homepage_config). */

export const WIKI_MODULES = [
  "intro",
  "characters",
  "locations",
  "organizations",
  "concepts",
  "items",
  "timeline",
  "works",
] as const;

export type WikiModule = (typeof WIKI_MODULES)[number];

/** Single default theme (paper). Kept as an array for forward-compat. */
export const WIKI_THEMES = ["paper"] as const;
export type WikiTheme = (typeof WIKI_THEMES)[number];

export const WIKI_LAYOUTS = ["classic", "sidebar", "magazine"] as const;
export type WikiLayout = (typeof WIKI_LAYOUTS)[number];

export const WIKI_HERO_STYLES = ["banner", "compact", "none"] as const;
export type WikiHeroStyle = (typeof WIKI_HERO_STYLES)[number];

export type HomepageConfig = {
  theme: WikiTheme;
  layout: WikiLayout;
  /** Optional accent override, #RRGGBB */
  accent: string;
  /** Visible modules in display order */
  modules: WikiModule[];
  showTags: boolean;
  heroStyle: WikiHeroStyle;
};

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
  theme: "paper",
  layout: "sidebar",
  accent: "",
  modules: [
    "intro",
    "characters",
    "locations",
    "organizations",
    "concepts",
    "items",
    "timeline",
    "works",
  ],
  showTags: true,
  heroStyle: "banner",
};

const MODULE_SET = new Set<string>(WIKI_MODULES);
const THEME_SET = new Set<string>(WIKI_THEMES);
const LAYOUT_SET = new Set<string>(WIKI_LAYOUTS);
const HERO_SET = new Set<string>(WIKI_HERO_STYLES);

function isHexColor(v: string): boolean {
  return /^#[0-9A-Fa-f]{6}$/.test(v);
}

export function normalizeHomepageConfig(
  raw: unknown,
): HomepageConfig {
  const src =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  const theme =
    typeof src.theme === "string" && THEME_SET.has(src.theme)
      ? (src.theme as WikiTheme)
      : DEFAULT_HOMEPAGE_CONFIG.theme;

  const layout =
    typeof src.layout === "string" && LAYOUT_SET.has(src.layout)
      ? (src.layout as WikiLayout)
      : DEFAULT_HOMEPAGE_CONFIG.layout;

  const heroStyle =
    typeof src.heroStyle === "string" && HERO_SET.has(src.heroStyle)
      ? (src.heroStyle as WikiHeroStyle)
      : DEFAULT_HOMEPAGE_CONFIG.heroStyle;

  const accent =
    typeof src.accent === "string" && isHexColor(src.accent)
      ? src.accent
      : "";

  let modules: WikiModule[] = DEFAULT_HOMEPAGE_CONFIG.modules;
  if (Array.isArray(src.modules)) {
    const seen = new Set<string>();
    const next: WikiModule[] = [];
    for (const m of src.modules) {
      if (typeof m === "string" && MODULE_SET.has(m) && !seen.has(m)) {
        seen.add(m);
        next.push(m as WikiModule);
      }
    }
    if (next.length > 0) modules = next;
  }

  const showTags =
    typeof src.showTags === "boolean"
      ? src.showTags
      : DEFAULT_HOMEPAGE_CONFIG.showTags;

  return { theme, layout, accent, modules, showTags, heroStyle };
}

export const MODULE_LABELS: Record<WikiModule, string> = {
  intro: "世界介绍",
  characters: "人物",
  locations: "地点",
  organizations: "势力",
  concepts: "概念",
  items: "物品",
  timeline: "时间轴",
  works: "作品",
};

export const THEME_LABELS: Record<WikiTheme, string> = {
  paper: "默认",
};

export const LAYOUT_LABELS: Record<WikiLayout, string> = {
  classic: "双栏（内容 + 信息栏）",
  sidebar: "三栏（目录 + 内容 + 信息栏）",
  magazine: "杂志（目录 + 双列内容）",
};

export const HERO_LABELS: Record<WikiHeroStyle, string> = {
  banner: "宽幅头图",
  compact: "紧凑头图",
  none: "无头图",
};
