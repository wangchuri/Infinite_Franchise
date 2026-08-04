/** Wiki homepage style config — mirrored with backend/src/homepage-config.ts */

export const WIKI_MODULES = [
  "intro",
  "characters",
  "items",
  "timeline",
] as const;

export type WikiModule = (typeof WIKI_MODULES)[number];

export const WIKI_THEMES = ["paper", "ink", "mist", "ember"] as const;
export type WikiTheme = (typeof WIKI_THEMES)[number];

export const WIKI_LAYOUTS = ["classic", "sidebar", "magazine"] as const;
export type WikiLayout = (typeof WIKI_LAYOUTS)[number];

export const WIKI_HERO_STYLES = ["banner", "compact", "none"] as const;
export type WikiHeroStyle = (typeof WIKI_HERO_STYLES)[number];

export type HomepageConfig = {
  theme: WikiTheme;
  layout: WikiLayout;
  accent: string;
  modules: WikiModule[];
  showTags: boolean;
  heroStyle: WikiHeroStyle;
};

export const DEFAULT_HOMEPAGE_CONFIG: HomepageConfig = {
  theme: "paper",
  layout: "classic",
  accent: "",
  modules: ["intro", "characters", "items", "timeline"],
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

export function normalizeHomepageConfig(raw: unknown): HomepageConfig {
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
  items: "物品",
  timeline: "时间轴",
};

export const THEME_LABELS: Record<WikiTheme, string> = {
  paper: "纸本（默认）",
  ink: "墨夜",
  mist: "青雾",
  ember: "赭火",
};

export const LAYOUT_LABELS: Record<WikiLayout, string> = {
  classic: "经典单栏",
  sidebar: "左侧目录",
  magazine: "杂志双栏",
};

export const HERO_LABELS: Record<WikiHeroStyle, string> = {
  banner: "宽幅头图",
  compact: "紧凑头图",
  none: "无头图",
};

/** CSS custom properties for Wiki themes */
export function themeCssVars(
  config: HomepageConfig,
): Record<string, string> {
  const palettes: Record<WikiTheme, Record<string, string>> = {
    paper: {
      "--wiki-bg": "#f3efe6",
      "--wiki-bg-2": "#e8e2d4",
      "--wiki-ink": "#14212b",
      "--wiki-ink-soft": "#2a3a47",
      "--wiki-accent": "#1f5c5a",
      "--wiki-card": "rgba(255, 254, 249, 0.72)",
      "--wiki-line": "rgba(20, 33, 43, 0.12)",
      "--wiki-hero-fg": "#f7f3ea",
    },
    ink: {
      "--wiki-bg": "#141c24",
      "--wiki-bg-2": "#1c2732",
      "--wiki-ink": "#e8e2d4",
      "--wiki-ink-soft": "#b8c0c8",
      "--wiki-accent": "#2f8a86",
      "--wiki-card": "rgba(28, 39, 50, 0.9)",
      "--wiki-line": "rgba(232, 226, 212, 0.14)",
      "--wiki-hero-fg": "#f7f3ea",
    },
    mist: {
      "--wiki-bg": "#e7efec",
      "--wiki-bg-2": "#d5e3df",
      "--wiki-ink": "#16302e",
      "--wiki-ink-soft": "#2f4f4c",
      "--wiki-accent": "#1f5c5a",
      "--wiki-card": "rgba(255, 255, 255, 0.7)",
      "--wiki-line": "rgba(22, 48, 46, 0.12)",
      "--wiki-hero-fg": "#f0f7f5",
    },
    ember: {
      "--wiki-bg": "#f4ebe3",
      "--wiki-bg-2": "#ead9cb",
      "--wiki-ink": "#2a1810",
      "--wiki-ink-soft": "#5a3a2a",
      "--wiki-accent": "#c45c26",
      "--wiki-card": "rgba(255, 250, 245, 0.75)",
      "--wiki-line": "rgba(42, 24, 16, 0.12)",
      "--wiki-hero-fg": "#fff4ea",
    },
  };

  const vars = { ...palettes[config.theme] };
  if (config.accent) {
    vars["--wiki-accent"] = config.accent;
  }
  return vars;
}
