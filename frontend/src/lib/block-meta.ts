/**
 * Editor metadata for wiki layout blocks: human labels, whether a block can be
 * added as a region, and the Inspector fields for its props.
 *
 * Only block types that are actually registered in world-blocks/registry.tsx
 * are listed as addable.
 */
import type { BlockType } from "./world-layout";

export type PropFieldType =
  | "text"
  | "textarea"
  | "html"
  | "css"
  | "richtext"
  | "markdown"
  | "boolean"
  | "select"
  | "collection"
  | "image"
  | "imageList"
  | "entryList"
  | "lines";

export type PropField = {
  key: string;
  label: string;
  type: PropFieldType;
  options?: { value: string; label: string }[];
  placeholder?: string;
};

export type BlockMeta = {
  label: string;
  hint?: string;
  addable: boolean;
  fields: PropField[];
  defaultProps?: Record<string, unknown>;
};

export const ENTRY_CATEGORIES = [
  { value: "character", label: "人物" },
  { value: "location", label: "地点" },
  { value: "item", label: "物品" },
  { value: "organization", label: "组织" },
  { value: "event", label: "事件" },
  { value: "concept", label: "概念" },
  { value: "other", label: "其他" },
] as const;

const CATEGORY_OPTIONS = ENTRY_CATEGORIES.map((c) => ({
  value: c.value,
  label: c.label,
}));

const SOURCE_OPTIONS = [
  { value: "intro", label: "世界介绍" },
  ...CATEGORY_OPTIONS,
];

export const BLOCK_META: Partial<Record<BlockType, BlockMeta>> = {
  topBar: { label: "顶部栏", addable: false, fields: [] },
  hero: {
    label: "世界头图",
    addable: false,
    fields: [
      { key: "showTags", label: "显示标签", type: "boolean" },
      { key: "compact", label: "紧凑模式", type: "boolean" },
    ],
  },
  columns: {
    label: "三栏容器",
    addable: false,
    fields: [
      {
        key: "ratio",
        label: "栏宽比例",
        type: "select",
        options: [
          { value: "224:1fr:300", label: "标准（左224 · 右300）" },
          { value: "260:1fr:320", label: "宽松" },
          { value: "0:1fr:300", label: "两栏（无左栏）" },
          { value: "224:1fr:0", label: "两栏（无右栏）" },
          { value: "0:1fr:0", label: "单栏" },
        ],
      },
    ],
  },
  bgRegion: {
    label: "背景区域",
    hint: "带背景图/渐变的区块，可在里面放其他区域",
    addable: true,
    defaultProps: {
      image: "",
      color: "",
      gradient: "",
      overlay: "0.35",
      minHeight: "320",
      padding: "2rem",
      fixed: false,
    },
    fields: [
      { key: "image", label: "背景图", type: "image" },
      { key: "color", label: "背景色", type: "text", placeholder: "#101820" },
      {
        key: "gradient",
        label: "渐变（CSS）",
        type: "text",
        placeholder: "linear-gradient(160deg,#17262c,#0e1a20)",
      },
      { key: "overlay", label: "暗色遮罩 0–1", type: "text", placeholder: "0.35" },
      { key: "minHeight", label: "最小高度", type: "text", placeholder: "320 或 60vh" },
      { key: "padding", label: "内边距", type: "text", placeholder: "2rem" },
      { key: "fixed", label: "背景固定（视差）", type: "boolean" },
    ],
  },
  footer: {
    label: "页脚",
    addable: false,
    fields: [{ key: "platformButton", label: "显示平台按钮", type: "boolean" }],
  },
  nav: { label: "侧边导航", addable: true, fields: [] },  navGrid: {
    label: "导航面板",
    hint: "归属瓦片网格，点击进入对应分类页",
    addable: true,
    defaultProps: {
      title: "导航",
      columns: "4",
      withIcon: true,
      showCount: true,
    },
    fields: [
      { key: "title", label: "标题", type: "text", placeholder: "导航" },
      {
        key: "columns",
        label: "每行数量",
        type: "select",
        options: [
          { value: "2", label: "2 列" },
          { value: "3", label: "3 列" },
          { value: "4", label: "4 列" },
          { value: "5", label: "5 列" },
          { value: "6", label: "6 列" },
        ],
      },
      { key: "withIcon", label: "显示图标", type: "boolean" },
      { key: "showCount", label: "显示词条数", type: "boolean" },
    ],
  },
  prose: {
    label: "富文本段落",
    addable: true,
    defaultProps: { source: "intro", title: "世界介绍" },
    fields: [
      { key: "title", label: "标题", type: "text", placeholder: "世界介绍" },
      {
        key: "source",
        label: "内容来源",
        type: "select",
        options: SOURCE_OPTIONS,
      },
    ],
  },
  entryGrid: {
    label: "条目区域",
    hint: "指定归属，自动列出该归属下的词条",
    addable: true,
    defaultProps: { category: "character", title: "人物", withImage: true, style: "grid" },
    fields: [
      { key: "title", label: "名称", type: "text" },
      {
        key: "category",
        label: "归属",
        type: "collection",
      },
      {
        key: "style",
        label: "显示样式",
        type: "select",
        options: [
          { value: "grid", label: "卡片网格" },
          { value: "list", label: "列表" },
        ],
      },
      { key: "withImage", label: "显示图片", type: "boolean" },
    ],
  },
  glossary: {
    label: "词条列表（旧）",
    addable: false,
    defaultProps: { category: "concept", title: "概念" },
    fields: [
      { key: "title", label: "名称", type: "text" },
      {
        key: "category",
        label: "归属",
        type: "collection",
      },
    ],
  },
  timeline: {
    label: "时间轴",
    addable: true,
    defaultProps: { title: "时间轴" },
    fields: [{ key: "title", label: "标题", type: "text" }],
  },
  workList: {
    label: "作品列表",
    addable: true,
    defaultProps: { title: "作品" },
    fields: [{ key: "title", label: "标题", type: "text" }],
  },
  infoBox: { label: "信息框", addable: true, fields: [] },
  customHtml: {
    label: "自定义 HTML",
    hint: "在沙箱 iframe 中运行；用 window.WORLD 读取世界数据",
    addable: true,
    defaultProps: {
      height: "360",
      html: "<h2>自定义内容</h2>\n<p>用 window.WORLD 读取世界数据。</p>\n",
      css: "",
    },
    fields: [
      { key: "height", label: "高度（px）", type: "text" },
      { key: "html", label: "HTML", type: "html", placeholder: "<div>…</div>" },
      { key: "css", label: "CSS", type: "css", placeholder: ".card { … }" },
    ],
  },
  // —— content blocks (entry bodies + world pages) ——
  heading: {
    label: "标题",
    addable: true,
    defaultProps: { text: "小标题", level: "2" },
    fields: [
      { key: "text", label: "文字", type: "text" },
      {
        key: "level",
        label: "级别",
        type: "select",
        options: [
          { value: "2", label: "二级" },
          { value: "3", label: "三级" },
        ],
      },
    ],
  },
  text: {
    label: "文本",
    hint: "支持 Markdown；用 [[词条名]] 链接词条",
    addable: true,
    defaultProps: { markdown: "在这里写正文…\n" },
    fields: [
      {
        key: "markdown",
        label: "Markdown",
        type: "markdown",
        placeholder: "支持 Markdown；输入 [[ 可链接词条",
      },
    ],
  },
  richText: {
    label: "富文本",
    hint: "所见即所得排版，可插入图片、切换 HTML 源码",
    addable: true,
    defaultProps: { html: "<p>在这里写内容…</p>" },
    fields: [{ key: "html", label: "内容", type: "richtext" }],
  },
  image: {
    label: "图片",
    addable: true,
    defaultProps: { url: "", caption: "", width: "full", align: "center" },
    fields: [
      { key: "url", label: "图片", type: "image" },
      { key: "caption", label: "说明", type: "text" },
      {
        key: "width",
        label: "宽度",
        type: "select",
        options: [
          { value: "full", label: "整行" },
          { value: "half", label: "一半" },
          { value: "third", label: "三分之一" },
        ],
      },
      {
        key: "align",
        label: "对齐",
        type: "select",
        options: [
          { value: "left", label: "左" },
          { value: "center", label: "居中" },
          { value: "right", label: "右" },
        ],
      },
    ],
  },
  gallery: {
    label: "图片组",
    addable: true,
    defaultProps: { urls: [], caption: "", columns: "3" },
    fields: [
      { key: "urls", label: "图片", type: "imageList" },
      { key: "caption", label: "说明", type: "text" },
      {
        key: "columns",
        label: "列数",
        type: "select",
        options: [
          { value: "2", label: "2 列" },
          { value: "3", label: "3 列" },
          { value: "4", label: "4 列" },
        ],
      },
    ],
  },
  quote: {
    label: "引用",
    addable: true,
    defaultProps: { text: "……", cite: "" },
    fields: [
      { key: "text", label: "引用内容", type: "textarea" },
      { key: "cite", label: "出处", type: "text" },
    ],
  },
  divider: {
    label: "分隔线",
    addable: true,
    defaultProps: { spacing: "md" },
    fields: [
      {
        key: "spacing",
        label: "间距",
        type: "select",
        options: [
          { value: "sm", label: "小" },
          { value: "md", label: "中" },
          { value: "lg", label: "大" },
        ],
      },
    ],
  },
  button: {
    label: "按钮",
    addable: true,
    defaultProps: { label: "了解更多", href: "", variant: "solid", target: "_self" },
    fields: [
      { key: "label", label: "文字", type: "text" },
      { key: "href", label: "链接", type: "text" },
      {
        key: "variant",
        label: "样式",
        type: "select",
        options: [
          { value: "solid", label: "实心" },
          { value: "outline", label: "描边" },
        ],
      },
      {
        key: "target",
        label: "打开方式",
        type: "select",
        options: [
          { value: "_self", label: "当前页" },
          { value: "_blank", label: "新窗口" },
        ],
      },
    ],
  },
  linkList: {
    label: "链接列表",
    addable: true,
    defaultProps: { title: "相关链接", items: [] },
    fields: [
      { key: "title", label: "标题", type: "text" },
      {
        key: "items",
        label: "链接",
        type: "lines",
        placeholder: "每行：标签 | 链接",
      },
    ],
  },
  relatedEntries: {
    label: "相关词条",
    addable: true,
    defaultProps: { title: "相关词条", slugs: [], columns: "3" },
    fields: [
      { key: "title", label: "标题", type: "text" },
      { key: "slugs", label: "词条", type: "entryList" },
      {
        key: "columns",
        label: "列数",
        type: "select",
        options: [
          { value: "2", label: "2 列" },
          { value: "3", label: "3 列" },
          { value: "4", label: "4 列" },
        ],
      },
    ],
  },
};

export const SLOT_LABELS: Record<string, string> = {
  left: "左栏",
  main: "主栏",
  right: "右栏",
  content: "内容",
};

export const SLOT_ORDER = ["left", "main", "right"];

export function blockLabel(type: string, props?: Record<string, unknown>): string {
  const meta = BLOCK_META[type as BlockType];
  const title = props?.title;
  if (typeof title === "string" && title.trim()) return title;
  return meta?.label ?? type;
}
