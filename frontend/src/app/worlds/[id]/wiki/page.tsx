"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import {
  downloadText,
  exportPageFile,
  exportWorldFile,
  parsePageImport,
} from "@/lib/layout-io";
import {
  LAYOUT_TEMPLATES,
  type LayoutTemplate,
} from "@/lib/layout-templates";
import { BLOCK_META, SLOT_LABELS, SLOT_ORDER } from "@/lib/block-meta";
import { entryAttributeFields } from "@/lib/entry-schema";
import BlockFields from "@/components/world-blocks/BlockFields";
import ImageUpload from "@/components/world-editor/ImageUpload";
import {
  createCollection,
  collectionName,
  type WorldCollection,
} from "@/lib/collections";
import {
  addBlockToSlot,
  findBlock,
  moveBlockTo,
  newBlockId,
  removeBlock,
  setBlockProps,
} from "@/lib/layout-edit";
import {
  buildDefaultLayout,
  type Block,
  type BlockType,
  type BlockVariant,
  type ComponentField,
  type ComponentFieldType,
  type VariantBox,
  type VariantMatchOp,
  type WorldLayout,
} from "@/lib/world-layout";
import {
  createWorldPage,
  deleteWorldAsset,
  fetchPageRevisions,
  fetchWorldAssets,
  fetchWorldById,
  recordWorldAsset,
  restorePageRevision,
  updateWorld,
  updateWorldPage,
  uploadImage,
  uploadFont,
  type TimelineEvent,
  type WikiEntry,
  type World,
  type WorldAsset,
  type WorldPage,
  type WorldPageRevision,
} from "@/lib/worlds";
import styles from "./wiki-editor.module.css";

const FRAME_GUTTER = 32;

const DEVICE_PRESETS = {
  desktop: { w: 1280, h: 800, label: "桌面" },
  tablet: { w: 834, h: 1112, label: "平板" },
  mobile: { w: 390, h: 844, label: "手机" },
} as const;
type DeviceKey = keyof typeof DEVICE_PRESETS;

const VARIANT_BLOCKS = new Set<BlockType>(["entryGrid", "glossary"]);

/** Container blocks whose child slots are editable in the hierarchy. */
const CONTAINER_SLOTS: Partial<Record<BlockType, string[]>> = {
  columns: SLOT_ORDER,
  bgRegion: ["content"],
};

function pageFor(
  pages: WorldPage[],
  key: string | null,
): WorldPage | undefined {
  return key === null
    ? pages.find((p) => p.kind === "home")
    : pages.find((p) => p.kind === "collection" && p.collectionKey === key);
}

/** Default layout for a collection (归属) page. */
function buildCollectionLayout(title: string, key: string): WorldLayout {
  return {
    version: 2,
    blocks: [
      { id: "topbar", type: "topBar" },
      {
        id: `grid-${key}`,
        type: "entryGrid",
        props: { category: key, title, withImage: true, style: "grid" },
      },
    ],
  };
}

function layoutFor(key: string | null, collections: WorldCollection[]): WorldLayout {
  if (key === null) return buildDefaultLayout();
  const name = collections.find((c) => c.key === key)?.name ?? key;
  return buildCollectionLayout(name, key);
}

/** Stable across SSR/CSR (avoid locale/timezone mismatch). */
function formatRevTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getMonth() + 1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Cache-buster for the preview iframe (kept outside render for the linter). */
function previewStamp(): number {
  return Date.now();
}

const OP_LABEL: Record<VariantMatchOp, string> = {
  eq: "=",
  neq: "≠",
  contains: "包含",
};

function allBlockIds(blocks: Block[]): Set<string> {
  const out = new Set<string>();
  const walk = (list: Block[]) => {
    for (const b of list) {
      out.add(b.id);
      if (b.slots) for (const arr of Object.values(b.slots)) walk(arr);
    }
  };
  walk(blocks);
  return out;
}

function applyHighlight(doc: Document, id: string) {
  doc.querySelectorAll<HTMLElement>("[data-ed-selected]").forEach((el) => {
    el.removeAttribute("data-ed-selected");
    el.style.outline = "";
    el.style.outlineOffset = "";
  });
  if (!id) return;
  const el = doc.getElementById(id);
  if (el) {
    el.setAttribute("data-ed-selected", "");
    el.style.outline = "2px solid #1f5c5a";
    el.style.outlineOffset = "2px";
  }
}

function variantsOf(block: Block): BlockVariant[] {
  return Array.isArray(block.props?.variants)
    ? (block.props.variants as BlockVariant[])
    : [];
}

function newVariant(isDefault: boolean): BlockVariant {
  return {
    id: newBlockId("v"),
    name: isDefault ? "默认卡片" : "新卡片",
    isDefault,
    match: isDefault
      ? null
      : { field: "attr.role", op: "eq", value: "" },
    fields: [{ key: "accent", label: "主色", type: "color", default: "#1f5c5a" }],
    values: {},
    html:
      '<a class="card" href="{{url}}" target="_blank">\n' +
      '  <strong style="color:{{prop.accent}}">{{title}}</strong>\n' +
      "  <p>{{excerpt}}</p>\n" +
      "</a>\n",
    css:
      ".card{display:block;padding:14px;border-radius:10px;border:1px solid #e0dacb;" +
      "background:#fffef9;text-decoration:none;color:inherit;}\n" +
      ".card p{margin:4px 0 0;font-size:.85rem;color:#6b6252;}\n",
  };
}

function AddRegionMenu({ onAdd }: { onAdd: (type: BlockType) => void }) {
  const [open, setOpen] = useState(false);
  const addable = (Object.keys(BLOCK_META) as BlockType[]).filter(
    (t) => BLOCK_META[t]?.addable,
  );
  return (
    <div className={styles.addWrap}>
      <button type="button" className={styles.addBtn} onClick={() => setOpen((v) => !v)}>
        + 区域
      </button>
      {open ? (
        <ul className={styles.addMenu}>
          {addable.map((t) => (
            <li key={t}>
              <button
                type="button"
                onClick={() => {
                  onAdd(t);
                  setOpen(false);
                }}
              >
                {BLOCK_META[t]?.label ?? t}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function WikiLayoutEditorPage() {
  const params = useParams<{ id: string }>();
  const worldId = params.id;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [collections, setCollections] = useState<WorldCollection[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [layout, setLayout] = useState<WorldLayout | null>(null);
  const [pageId, setPageId] = useState<string | null>(null);
  const [pageCss, setPageCss] = useState("");
  const [pages, setPages] = useState<WorldPage[]>([]);
  /** null = home page, otherwise the collection key. */
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string>("");
  const [dragId, setDragId] = useState<string>("");
  const [dropTarget, setDropTarget] = useState<{
    id: string;
    position: "before" | "after";
  } | null>(null);
  const [editingVariant, setEditingVariant] = useState<{
    blockId: string;
    variantId: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<Date | null>(null);
  const [revisions, setRevisions] = useState<WorldPageRevision[]>([]);
  const [assets, setAssets] = useState<WorldAsset[]>([]);
  const [assetsOpen, setAssetsOpen] = useState(false);
  const [confirmState, setConfirmState] = useState<{
    message: string;
    onConfirm: () => void;
  } | null>(null);
  const [exportState, setExportState] = useState<{
    filename: string;
    json: string;
  } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);
  const [device, setDevice] = useState<DeviceKey>("desktop");
  const [availW, setAvailW] = useState(0);
  const [availH, setAvailH] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const importRef = useRef<HTMLInputElement>(null);
  const assetRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchWorldById(worldId);
        if (!data.isOwner) throw new Error("无权编辑此世界观");
        if (cancelled) return;
        setWorld(data.world);
        setEntries(data.entries);
        setCollections(data.collections);
        setTimeline(data.timeline);
        setPages(data.pages);
        setActiveKey(null);
        void fetchWorldAssets(data.world.id)
          .then((list) => {
            if (!cancelled) setAssets(list);
          })
          .catch(() => {});
        const home = pageFor(data.pages, null);
        if (home && home.layout.blocks.length) {
          setPageId(home.id);
          setPageCss(home.css);
          setLayout(home.layout);
          setDirty(false);
        } else {
          setPageId(home?.id ?? null);
          setPageCss(home?.css ?? "");
          setLayout(buildDefaultLayout());
          setDirty(true);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
  }, [router]);

  const mutate = useCallback((next: WorldLayout) => {
    setLayout(next);
    setDirty(true);
  }, []);

  useEffect(() => {
    if (!dirty || !layout || !world) return;
    const t = window.setTimeout(() => {
      void (async () => {
        setSaving(true);
        try {
          if (pageId) {
            const saved = await updateWorldPage(world.id, pageId, {
              layout,
              css: pageCss,
            });
            setPages((prev) =>
              prev.map((p) => (p.id === saved.id ? saved : p)),
            );
          } else {
            const created = await createWorldPage(world.id, {
              kind: activeKey === null ? "home" : "collection",
              collectionKey: activeKey,
              layout,
              css: pageCss,
            });
            setPageId(created.id);
            setPages((prev) => [...prev, created]);
          }
          setSavedAt(new Date());
          setDirty(false);
          setError(null);
          setPreviewKey(Date.now());
        } catch (err) {
          setError(err instanceof Error ? err.message : "保存失败");
        } finally {
          setSaving(false);
        }
      })();
    }, 700);
    return () => window.clearTimeout(t);
  }, [dirty, layout, world, pageId, pageCss, activeKey]);

  // Revision history for the current page (refreshed after each save).
  useEffect(() => {
    if (!world || !pageId) return;
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchPageRevisions(world.id, pageId);
        if (!cancelled) setRevisions(list);
      } catch {
        if (!cancelled) setRevisions([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [world, pageId, savedAt]);

  // Auto-dismiss the transient notice.
  useEffect(() => {
    if (!notice) return;
    const t = window.setTimeout(() => setNotice(null), 4000);
    return () => window.clearTimeout(t);
  }, [notice]);

  /** Persist the current page (used before switching pages). */
  async function flushPage() {
    if (!world || !layout || !dirty) return;
    try {
      if (pageId) {
        const saved = await updateWorldPage(world.id, pageId, {
          layout,
          css: pageCss,
        });
        setPages((prev) => prev.map((p) => (p.id === saved.id ? saved : p)));
      } else {
        const created = await createWorldPage(world.id, {
          kind: activeKey === null ? "home" : "collection",
          collectionKey: activeKey,
          layout,
          css: pageCss,
        });
        setPageId(created.id);
        setPages((prev) => [...prev, created]);
      }
      setDirty(false);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function selectPage(key: string | null) {
    if (key === activeKey) return;
    await flushPage();
    setActiveKey(key);
    setSelectedId("");
    setEditingVariant(null);
    const page = pageFor(pages, key);
    if (page && page.layout.blocks.length) {
      setPageId(page.id);
      setPageCss(page.css);
      setLayout(page.layout);
      setDirty(false);
    } else {
      setPageId(page?.id ?? null);
      setPageCss(page?.css ?? "");
      setLayout(layoutFor(key, collections));
      setDirty(true);
    }
  }

  function snapshotPage() {
    const current: WorldLayout = layout ?? { version: 2, blocks: [] };
    return {
      kind: (activeKey === null ? "home" : "collection") as "home" | "collection",
      collectionKey: activeKey,
      title: "",
      slug: "",
      css: pageCss,
      layout: current,
    };
  }

  function exportCurrentPage() {
    if (!layout) return;
    setExportState({
      filename: `wiki-${activeKey ?? "home"}.json`,
      json: JSON.stringify(exportPageFile(snapshotPage()), null, 2),
    });
  }

  function exportWorld() {
    const key = activeKey;
    const inPages = pages.some((p) =>
      key === null
        ? p.kind === "home"
        : p.kind === "collection" && p.collectionKey === key,
    );
    const list = pages.map((p) => {
      const isActive =
        key === null
          ? p.kind === "home"
          : p.kind === "collection" && p.collectionKey === key;
      return isActive ? snapshotPage() : p;
    });
    if (!inPages) list.push(snapshotPage());
    setExportState({
      filename: "wiki-world.json",
      json: JSON.stringify(exportWorldFile(list), null, 2),
    });
  }

  function copyExport() {
    if (!exportState) return;
    void navigator.clipboard?.writeText(exportState.json).catch(() => {});
    setNotice("已复制 JSON");
  }

  function downloadExport() {
    if (!exportState) return;
    downloadText(exportState.filename, exportState.json);
  }

  function askConfirm(message: string, onConfirm: () => void) {
    setConfirmState({ message, onConfirm });
  }

  async function onImportFile(file: File | undefined) {
    if (!file) return;
    try {
      const { layout: nextLayout, css } = parsePageImport(await file.text());
      askConfirm("导入将替换当前页的布局与 CSS，确定？", () => {
        mutate(nextLayout);
        setPageCss(css);
        setDirty(true);
        setSelectedId("");
        setEditingVariant(null);
        setError(null);
        setNotice(`已导入 ${nextLayout.blocks.length} 个区块`);
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "导入失败");
    }
  }

  function applyTemplate(template: LayoutTemplate) {
    askConfirm(`套用「${template.name}」会替换当前页的布局，确定？`, () => {
      mutate(template.build());
      setSelectedId("");
      setEditingVariant(null);
      setDirty(true);
      setError(null);
      setNotice(`已套用模板：${template.name}`);
    });
  }

  async function doRestore(revisionId: string) {
    if (!world || !pageId) return;
    try {
      const page = await restorePageRevision(world.id, pageId, revisionId);
      setLayout(page.layout);
      setPageCss(page.css);
      setPages((prev) => prev.map((p) => (p.id === page.id ? page : p)));
      setDirty(false);
      setSelectedId("");
      setEditingVariant(null);
      setPreviewKey(previewStamp());
      setSavedAt(new Date());
      setError(null);
      setNotice("已还原到该版本");
    } catch (err) {
      setError(err instanceof Error ? err.message : "还原失败");
    }
  }

  function restoreRevision(revisionId: string) {
    askConfirm("还原到该版本？当前版本会先存入历史。", () => {
      void doRestore(revisionId);
    });
  }

  async function uploadAsset(file: File | undefined) {
    if (!file || !world) return;
    try {
      const url = await uploadImage(file);
      const asset = await recordWorldAsset(world.id, {
        url,
        filename: file.name,
        size: file.size,
      });
      setAssets((prev) => [asset, ...prev.filter((a) => a.url !== asset.url)]);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    }
  }

  async function removeAsset(assetId: string) {
    if (!world) return;
    try {
      await deleteWorldAsset(world.id, assetId);
      setAssets((prev) => prev.filter((a) => a.id !== assetId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  function copyAsset(url: string) {
    void navigator.clipboard?.writeText(url).catch(() => {});
  }

  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const update = () => {
      setAvailW(el.clientWidth);
      setAvailH(el.clientHeight);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready]);

  const blockIds = useMemo(() => allBlockIds(layout?.blocks ?? []), [layout]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc && doc.readyState !== "loading") applyHighlight(doc, selectedId);
  }, [selectedId]);

  function selectBlock(id: string) {
    setSelectedId(id);
    setEditingVariant(null);
  }

  function onFrameLoad() {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        let cur = e.target as HTMLElement | null;
        while (cur) {
          if (cur.id && blockIds.has(cur.id)) {
            setSelectedId(cur.id);
            setEditingVariant(null);
            return;
          }
          cur = cur.parentElement;
        }
      },
      true,
    );
    applyHighlight(doc, selectedId);
  }

  function onAdd(parentId: string, slotKey: string, type: BlockType) {
    if (!layout) return;
    const meta = BLOCK_META[type];
    const block: Block = { id: newBlockId(type), type };
    if (meta?.defaultProps) block.props = { ...meta.defaultProps };
    mutate({
      ...layout,
      blocks: addBlockToSlot(layout.blocks, parentId, slotKey, block),
    });
    selectBlock(block.id);
  }

  function onRemove(id: string) {
    if (!layout) return;
    mutate({ ...layout, blocks: removeBlock(layout.blocks, id) });
    setSelectedId("");
  }

  function onMoveTo(
    sourceId: string,
    targetId: string,
    position: "before" | "after",
  ) {
    if (!layout || sourceId === targetId) return;
    mutate({
      ...layout,
      blocks: moveBlockTo(layout.blocks, sourceId, targetId, position),
    });
  }

  function onProp(id: string, key: string, value: unknown) {
    if (!layout) return;
    mutate({
      ...layout,
      blocks: setBlockProps(layout.blocks, id, { [key]: value }),
    });
  }

  // —— variants ——
  function setVariants(blockId: string, variants: BlockVariant[]) {
    onProp(blockId, "variants", variants);
  }

  function addVariant(block: Block) {
    const list = variantsOf(block);
    const hasDefault = list.some((v) => v.isDefault);
    setVariants(block.id, [...list, newVariant(!hasDefault)]);
  }

  function patchVariant(
    blockId: string,
    variantId: string,
    patch: Partial<BlockVariant>,
  ) {
    if (!layout) return;
    const block = findBlock(layout.blocks, blockId);
    if (!block) return;
    setVariants(
      blockId,
      variantsOf(block).map((v) => (v.id === variantId ? { ...v, ...patch } : v)),
    );
  }

  function patchBox(
    blockId: string,
    variantId: string,
    patch: Partial<VariantBox>,
  ) {
    if (!layout) return;
    const block = findBlock(layout.blocks, blockId);
    if (!block) return;
    const variant = variantsOf(block).find((v) => v.id === variantId);
    if (!variant) return;
    const next: VariantBox = { ...(variant.box ?? {}), ...patch };
    for (const key of Object.keys(next) as (keyof VariantBox)[]) {
      const value = next[key];
      if (value === undefined || value === "") delete next[key];
    }
    patchVariant(blockId, variantId, { box: next });
  }

  function removeVariant(blockId: string, variantId: string) {
    if (!layout) return;
    const block = findBlock(layout.blocks, blockId);
    if (!block) return;
    setVariants(
      blockId,
      variantsOf(block).filter((v) => v.id !== variantId),
    );
    setEditingVariant(null);
  }

  function setVariantValue(
    blockId: string,
    variantId: string,
    key: string,
    value: string,
  ) {
    if (!layout) return;
    const block = findBlock(layout.blocks, blockId);
    if (!block) return;
    setVariants(
      blockId,
      variantsOf(block).map((v) =>
        v.id === variantId ? { ...v, values: { ...v.values, [key]: value } } : v,
      ),
    );
  }

  function addVariantField(blockId: string, variantId: string) {
    if (!layout) return;
    const block = findBlock(layout.blocks, blockId);
    if (!block) return;
    setVariants(
      blockId,
      variantsOf(block).map((v) =>
        v.id === variantId
          ? {
              ...v,
              fields: [
                ...v.fields,
                {
                  key: `prop${v.fields.length + 1}`,
                  label: "属性",
                  type: "text" as ComponentFieldType,
                  default: "",
                },
              ],
            }
          : v,
      ),
    );
  }

  function updateVariantField(
    blockId: string,
    variantId: string,
    index: number,
    patch: Partial<ComponentField>,
  ) {
    if (!layout) return;
    const block = findBlock(layout.blocks, blockId);
    if (!block) return;
    setVariants(
      blockId,
      variantsOf(block).map((v) =>
        v.id === variantId
          ? {
              ...v,
              fields: v.fields.map((f, i) => (i === index ? { ...f, ...patch } : f)),
            }
          : v,
      ),
    );
  }

  function removeVariantField(blockId: string, variantId: string, index: number) {
    if (!layout) return;
    const block = findBlock(layout.blocks, blockId);
    if (!block) return;
    setVariants(
      blockId,
      variantsOf(block).map((v) =>
        v.id === variantId
          ? { ...v, fields: v.fields.filter((_, i) => i !== index) }
          : v,
      ),
    );
  }

  async function doUpload(
    file: File | undefined,
    kind: "image" | "font",
    apply: (url: string) => void,
  ) {
    if (!file) return;
    setError(null);
    try {
      const url = kind === "font" ? await uploadFont(file) : await uploadImage(file);
      apply(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    }
  }

  async function setWikiBackground(url: string | null) {
    if (!world) return;
    setWorld({ ...world, wikiBackgroundUrl: url });
    setError(null);
    try {
      await updateWorld(world.id, { wikiBackgroundUrl: url });
      setPreviewKey(Date.now());
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存背景图失败");
    }
  }

  async function createCollectionForBlock(
    name: string,
  ): Promise<WorldCollection | null> {
    if (!world) return null;
    setError(null);
    try {
      const created = await createCollection(world.id, { name });
      setCollections((prev) => [...prev, created]);
      return created;
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建归属失败");
      return null;
    }
  }

  if (!ready) return <p className={styles.loading}>加载排版编辑器…</p>;
  if (!world || !layout) {
    return <p className={styles.error}>{error ?? "世界观不存在"}</p>;
  }

  const usingSample =
    timeline.length === 0 ||
    collections.some((c) => !entries.some((e) => e.category === c.key));

  const previewPath =
    activeKey === null
      ? `/w/${world.slug}/wiki`
      : `/w/${world.slug}/c/${encodeURIComponent(activeKey)}`;
  const previewSrc = `${previewPath}?preview=1&v=${previewKey}`;
  const frame = DEVICE_PRESETS[device];
  const fit = Math.min(
    (availW - FRAME_GUTTER) / frame.w,
    (availH - FRAME_GUTTER) / frame.h,
  );
  const scale = availW > 0 && availH > 0 ? Math.max(0.1, Math.min(1, fit)) : 1;
  const selected = selectedId ? findBlock(layout.blocks, selectedId) : null;

  function renderRow(block: Block, depth: number) {
    const on = block.id === selectedId;
    const vs = variantsOf(block);
    const drop = dropTarget?.id === block.id ? dropTarget.position : null;
    const className = [
      on ? styles.rowOn : styles.row,
      styles.rowDrag,
      dragId === block.id ? styles.rowDragging : "",
      drop === "before" ? styles.dropBefore : "",
      drop === "after" ? styles.dropAfter : "",
    ]
      .filter(Boolean)
      .join(" ");
    return (
      <div
        key={block.id}
        className={className}
        style={{ paddingLeft: `${0.5 + depth * 0.8}rem` }}
        draggable
        onDragStart={(e) => {
          setDragId(block.id);
          e.dataTransfer.effectAllowed = "move";
        }}
        onDragEnd={() => {
          setDragId("");
          setDropTarget(null);
        }}
        onDragOver={(e) => {
          if (!dragId || dragId === block.id) return;
          e.preventDefault();
          e.dataTransfer.dropEffect = "move";
          const rect = e.currentTarget.getBoundingClientRect();
          const after = e.clientY > rect.top + rect.height / 2;
          setDropTarget({ id: block.id, position: after ? "after" : "before" });
        }}
        onDrop={(e) => {
          e.preventDefault();
          const target = dropTarget;
          if (dragId && target) onMoveTo(dragId, target.id, target.position);
          setDragId("");
          setDropTarget(null);
        }}
      >
        <span className={styles.grip} aria-hidden="true">
          ⠿
        </span>
        <button type="button" className={styles.rowLabel} onClick={() => selectBlock(block.id)}>
          <span className={styles.rowType}>
            {BLOCK_META[block.type]?.label ?? block.type}
          </span>
          {block.props?.title ? (
            <span className={styles.rowTitle}>{String(block.props.title)}</span>
          ) : null}
          {vs.length > 0 ? (
            <span className={styles.rowTitle}>{vs.length} 种卡片</span>
          ) : null}
        </button>
        <span className={styles.rowActions}>
          <button type="button" aria-label="删除" onClick={() => onRemove(block.id)}>
            ×
          </button>
        </span>
      </div>
    );
  }

  function renderHierarchy(blocks: Block[]): ReactNode {
    return blocks.map((b) => {
      const containerKeys = CONTAINER_SLOTS[b.type];
      if (containerKeys) {
        const slots = b.slots ?? {};
        const present = containerKeys.filter((k) => (slots[k] ?? []).length > 0);
        const keys = present.length ? present : [containerKeys[0]];
        return (
          <div key={b.id} className={styles.group}>
            <button
              type="button"
              className={b.id === selectedId ? styles.groupHeadOn : styles.groupHead}
              onClick={() => selectBlock(b.id)}
            >
              {BLOCK_META[b.type]?.label ?? b.type}
            </button>
            {keys.map((k) => (
              <div key={k} className={styles.slot}>
                <div className={styles.slotHead}>
                  <span>{SLOT_LABELS[k] ?? k}</span>
                  <AddRegionMenu onAdd={(t) => onAdd(b.id, k, t)} />
                </div>
                {(slots[k] ?? []).map((child) => renderRow(child, 1))}
              </div>
            ))}
          </div>
        );
      }
      return renderRow(b, 0);
    });
  }

  function renderVariantValue(block: Block, v: BlockVariant, f: ComponentField) {
    const val = v.values[f.key] ?? "";
    const set = (x: string) => setVariantValue(block.id, v.id, f.key, x);
    if (f.type === "image") {
      return (
        <label key={f.key} className={styles.field}>
          <span>{f.label}</span>
          <input type="file" accept="image/*" onChange={(e) => void doUpload(e.target.files?.[0], "image", set)} />
          {val ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={val} alt="" className={styles.thumb} />
          ) : null}
        </label>
      );
    }
    if (f.type === "font") {
      return (
        <label key={f.key} className={styles.field}>
          <span>{f.label}（字体文件）</span>
          <input type="file" accept=".ttf,.otf,.woff,.woff2" onChange={(e) => void doUpload(e.target.files?.[0], "font", set)} />
          {val ? <span className={styles.muted}>{val.split("/").pop()}</span> : null}
        </label>
      );
    }
    if (f.type === "color") {
      return (
        <label key={f.key} className={styles.field}>
          <span>{f.label}</span>
          <input
            type="color"
            value={/^#[0-9A-Fa-f]{6}$/.test(val) ? val : "#14212b"}
            onChange={(e) => set(e.target.value)}
          />
        </label>
      );
    }
    return (
      <label key={f.key} className={styles.field}>
        <span>{f.label}</span>
        <input value={val} onChange={(e) => set(e.target.value)} />
      </label>
    );
  }

  function renderVariantEditor(block: Block, v: BlockVariant) {
    const category =
      typeof block.props?.category === "string" ? block.props.category : "";
    const attrFields = entryAttributeFields(category, collections);
    return (
      <div className={styles.inspector}>
        <button
          type="button"
          className={styles.linkBtn}
          onClick={() => setEditingVariant(null)}
        >
          ← 返回区域
        </button>
        <div className={styles.inspectorHead}>卡片样式</div>
        <label className={styles.field}>
          <span>名称</span>
          <input
            value={v.name}
            maxLength={60}
            onChange={(e) => patchVariant(block.id, v.id, { name: e.target.value })}
          />
        </label>

        <div className={styles.subHead}>外观（可被下方 CSS 覆盖）</div>
        <ImageUpload
          label="默认图片（词条无图时）"
          value={v.defaultImage ?? ""}
          onChange={(url) =>
            patchVariant(block.id, v.id, { defaultImage: url ?? "" })
          }
          aspect="wide"
        />
        <ImageUpload
          label="背景图"
          value={v.box?.bgImage ?? ""}
          onChange={(url) => patchBox(block.id, v.id, { bgImage: url ?? "" })}
          aspect="wide"
        />
        <div className={styles.fieldRow}>
          <input
            className={styles.mini}
            value={v.box?.width ?? ""}
            placeholder="宽 220px"
            onChange={(e) => patchBox(block.id, v.id, { width: e.target.value })}
          />
          <input
            className={styles.mini}
            value={v.box?.height ?? ""}
            placeholder="高 260px"
            onChange={(e) => patchBox(block.id, v.id, { height: e.target.value })}
          />
          <input
            className={styles.mini}
            value={v.box?.radius ?? ""}
            placeholder="圆角 12px"
            onChange={(e) => patchBox(block.id, v.id, { radius: e.target.value })}
          />
        </div>
        <div className={styles.fieldRow}>
          <label className={styles.mini}>
            背景色
            <input
              type="color"
              value={v.box?.bgColor ?? "#ffffff"}
              onChange={(e) =>
                patchBox(block.id, v.id, { bgColor: e.target.value })
              }
            />
          </label>
          <label className={styles.mini}>
            透明度
            <input
              type="number"
              min={0}
              max={1}
              step={0.05}
              value={v.box?.opacity ?? ""}
              onChange={(e) =>
                patchBox(block.id, v.id, {
                  opacity:
                    e.target.value === "" ? undefined : Number(e.target.value),
                })
              }
            />
          </label>
        </div>

        {v.isDefault ? (
          <p className={styles.muted}>默认卡片：其他条件未命中时使用。</p>
        ) : (
          <div className={styles.field}>
            <span>匹配条件</span>
            <div className={styles.condRow}>
              <select
                value={v.match?.field ?? ""}
                onChange={(e) =>
                  patchVariant(block.id, v.id, {
                    match: {
                      field: e.target.value,
                      op: v.match?.op ?? "eq",
                      value: v.match?.value ?? "",
                    },
                  })
                }
              >
                <option value="">选择属性</option>
                {attrFields.map((f) => (
                  <option key={f.key} value={`attr.${f.key}`}>
                    {f.label}
                  </option>
                ))}
              </select>
              <select
                value={v.match?.op ?? "eq"}
                onChange={(e) =>
                  patchVariant(block.id, v.id, {
                    match: {
                      field: v.match?.field ?? "",
                      op: e.target.value as VariantMatchOp,
                      value: v.match?.value ?? "",
                    },
                  })
                }
              >
                <option value="eq">等于</option>
                <option value="neq">不等于</option>
                <option value="contains">包含</option>
              </select>
              <input
                value={v.match?.value ?? ""}
                placeholder="值，如 NPC"
                onChange={(e) =>
                  patchVariant(block.id, v.id, {
                    match: {
                      field: v.match?.field ?? "",
                      op: v.match?.op ?? "eq",
                      value: e.target.value,
                    },
                  })
                }
              />
            </div>
          </div>
        )}

        {v.fields.length > 0 ? (
          <>
            <div className={styles.subHead}>额外属性</div>
            {v.fields.map((f) => renderVariantValue(block, v, f))}
          </>
        ) : null}

        <details className={styles.advanced}>
          <summary>高级（HTML / CSS / 自定义属性）</summary>
          <div className={styles.advBody}>
            <div className={styles.subHead}>属性定义</div>
            {v.fields.map((f, i) => (
              <div key={i} className={styles.fieldRow}>
                <input
                  className={styles.mini}
                  value={f.key}
                  placeholder="key"
                  onChange={(e) =>
                    updateVariantField(block.id, v.id, i, { key: e.target.value })
                  }
                />
                <input
                  className={styles.mini}
                  value={f.label}
                  placeholder="标签"
                  onChange={(e) =>
                    updateVariantField(block.id, v.id, i, { label: e.target.value })
                  }
                />
                <select
                  className={styles.mini}
                  value={f.type}
                  onChange={(e) =>
                    updateVariantField(block.id, v.id, i, {
                      type: e.target.value as ComponentFieldType,
                    })
                  }
                >
                  <option value="text">文本</option>
                  <option value="image">图片</option>
                  <option value="color">颜色</option>
                  <option value="font">字体</option>
                </select>
                <input
                  className={styles.mini}
                  value={f.default ?? ""}
                  placeholder="默认值"
                  onChange={(e) =>
                    updateVariantField(block.id, v.id, i, { default: e.target.value })
                  }
                />
                <button
                  type="button"
                  onClick={() => removeVariantField(block.id, v.id, i)}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              className={styles.addBtn}
              onClick={() => addVariantField(block.id, v.id)}
            >
              + 属性
            </button>

            <label className={styles.field}>
              <span>HTML</span>
              <textarea
                rows={8}
                spellCheck={false}
                value={v.html}
                onChange={(e) => patchVariant(block.id, v.id, { html: e.target.value })}
              />
            </label>
            <label className={styles.field}>
              <span>CSS</span>
              <textarea
                rows={8}
                spellCheck={false}
                value={v.css}
                onChange={(e) => patchVariant(block.id, v.id, { css: e.target.value })}
              />
            </label>
            <p className={styles.muted}>
              词条：{"{{title}} {{slug}} {{excerpt}} {{imageUrl}} {{content}}"}；
              属性：{"{{attr.角色字段}}"}；额外属性：{"{{prop.key}}"}
            </p>
          </div>
        </details>

        <button
          type="button"
          className={styles.dangerBtn}
          onClick={() => removeVariant(block.id, v.id)}
        >
          删除该卡片
        </button>
      </div>
    );
  }

  function renderInspector() {
    if (editingVariant) {
      const block = findBlock(layout!.blocks, editingVariant.blockId);
      const v = block
        ? variantsOf(block).find((x) => x.id === editingVariant.variantId)
        : null;
      if (block && v) return renderVariantEditor(block, v);
    }
    if (!selected) {
      return (
        <p className={styles.inspectorEmpty}>
          在左侧结构或预览里选择一个区域。
        </p>
      );
    }
    const meta = BLOCK_META[selected.type];
    return (
      <div className={styles.inspector}>
        <div className={styles.inspectorHead}>{meta?.label ?? selected.type}</div>
        <label className={styles.check}>
          <input
            type="checkbox"
            checked={selected.props?.hideOnMobile === true}
            onChange={(e) =>
              onProp(selected.id, "hideOnMobile", e.target.checked)
            }
          />
          手机端隐藏
        </label>
        <BlockFields
          block={selected}
          onChange={(key, value) => onProp(selected.id, key, value)}
          collections={collections}
          entries={entries}
          onError={setError}
          onCreateCollection={createCollectionForBlock}
        />
        {VARIANT_BLOCKS.has(selected.type) ? renderRegionVariants(selected) : null}
      </div>
    );
  }

  function renderRegionVariants(block: Block) {
    const list = variantsOf(block);
    return (
      <div className={styles.variants}>
        <div className={styles.subHead}>卡片样式（元组件）</div>
        {list.length === 0 ? (
          <p className={styles.inspectorEmpty}>使用默认卡片。可新建自定义卡片。</p>
        ) : (
          list.map((v) => (
            <button
              key={v.id}
              type="button"
              className={styles.compRow}
              onClick={() =>
                setEditingVariant({ blockId: block.id, variantId: v.id })
              }
            >
              {v.name}
              {v.isDefault
                ? "（默认）"
                : v.match
                  ? ` · ${v.match.field.replace(/^attr\./, "")} ${OP_LABEL[v.match.op]} ${v.match.value}`
                  : ""}
            </button>
          ))
        )}
        <button type="button" className={styles.addBtn} onClick={() => addVariant(block)}>
          + 新建组件
        </button>
      </div>
    );
  }

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href={`/worlds/${world.id}/edit`} className={styles.back}>
          ← 返回编辑器
        </Link>
        <strong className={styles.docName}>
          {world.name} ·{" "}
          {activeKey === null
            ? "Wiki 界面"
            : collectionName(collections, activeKey)}
        </strong>
        {notice ? <span className={styles.notice}>{notice}</span> : null}
        <span className={styles.ioActions}>
          <button
            type="button"
            className={styles.ioBtn}
            onClick={exportCurrentPage}
          >
            导出本页
          </button>
          <button type="button" className={styles.ioBtn} onClick={exportWorld}>
            导出世界
          </button>
          <button
            type="button"
            className={styles.ioBtn}
            onClick={() => importRef.current?.click()}
          >
            导入
          </button>
          <button
            type="button"
            className={styles.ioBtn}
            onClick={() => setAssetsOpen(true)}
          >
            素材库
          </button>
        </span>
        <input
          ref={importRef}
          type="file"
          accept=".json,application/json"
          hidden
          onChange={(e) => {
            void onImportFile(e.target.files?.[0]);
            e.target.value = "";
          }}
        />
        <span className={styles.saveState}>
          {saving ? "保存中…" : dirty ? "未保存" : savedAt ? "已保存" : ""}
        </span>
      </header>

      <div className={styles.body}>
        <aside className={styles.paneLeft}>
          <details className={styles.templateBox}>
            <summary>套用模板</summary>
            <div className={styles.templateList}>
              {LAYOUT_TEMPLATES.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={styles.templateItem}
                  onClick={() => applyTemplate(t)}
                >
                  <strong>{t.name}</strong>
                  <span>{t.description}</span>
                </button>
              ))}
            </div>
          </details>
          <div className={styles.pageTabs}>
            <button
              type="button"
              className={activeKey === null ? styles.pageTabOn : styles.pageTab}
              onClick={() => void selectPage(null)}
            >
              首页
            </button>
            {collections.map((c) => (
              <button
                key={c.key}
                type="button"
                className={activeKey === c.key ? styles.pageTabOn : styles.pageTab}
                onClick={() => void selectPage(c.key)}
              >
                {c.name}
              </button>
            ))}
          </div>
          <p className={styles.paneTitle}>结构 / Hierarchy</p>
          <div className={styles.tree}>{renderHierarchy(layout.blocks)}</div>
        </aside>

        <div className={styles.paneCenter}>
          <div className={styles.canvasBar}>
            <span>预览</span>
            <span className={styles.devices}>
              {(Object.keys(DEVICE_PRESETS) as DeviceKey[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  className={device === k ? styles.deviceOn : styles.deviceBtn}
                  onClick={() => setDevice(k)}
                >
                  {DEVICE_PRESETS[k].label}
                </button>
              ))}
            </span>
            <span className={styles.zoom}>{Math.round(scale * 100)}%</span>
            <button
              type="button"
              className={styles.deviceBtn}
              title="重新加载预览"
              onClick={() => setPreviewKey(previewStamp())}
            >
              刷新预览
            </button>
          </div>
          <div className={styles.canvasViewport} ref={viewportRef}>
            {usingSample ? (
              <span className={styles.sampleFloat}>正在使用示例数据</span>
            ) : null}
            <div
              className={styles.deviceWrap}
              style={{ width: frame.w * scale, height: frame.h * scale }}
            >
              <div
                className={styles.device}
                style={{
                  width: frame.w,
                  height: frame.h,
                  transform: `scale(${scale})`,
                }}
              >
                <div className={styles.deviceBar}>
                  <span className={styles.dots}>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className={styles.deviceUrl}>{previewPath}</span>
                </div>
                <iframe
                  ref={iframeRef}
                  className={styles.deviceFrame}
                  src={previewSrc}
                  title="Wiki 预览"
                  onLoad={onFrameLoad}
                />
              </div>
            </div>
          </div>
        </div>

        <aside className={styles.paneRight}>
          <p className={styles.paneTitle}>属性 / Inspector</p>
          <div className={styles.bgUpload}>
            <ImageUpload
              label="Wiki 背景图"
              value={world.wikiBackgroundUrl}
              onChange={(url) => void setWikiBackground(url)}
              aspect="wide"
            />
          </div>
          <details className={styles.pageCss}>
            <summary>页面 CSS</summary>
            <p className={styles.muted}>
              按页保存：首页与各归属页各自独立；自动限制在本页范围内。
            </p>
            <textarea
              className={styles.cssInput}
              rows={8}
              spellCheck={false}
              value={pageCss}
              placeholder={"/* 例：.hero { --tone: #b5651d; } */"}
              onChange={(e) => {
                setPageCss(e.target.value);
                setDirty(true);
              }}
            />
          </details>
          <details className={styles.pageCss}>
            <summary>历史版本（{revisions.length}）</summary>
            <p className={styles.muted}>
              每条为保存前快照；还原会先保存当前版本。
            </p>
            {revisions.length === 0 ? (
              <p className={styles.muted}>还没有历史版本。</p>
            ) : (
              <ul className={styles.revList}>
                {revisions.map((r) => (
                  <li key={r.id} className={styles.revItem}>
                    <span>{formatRevTime(r.createdAt)}</span>
                    <button
                      type="button"
                      className={styles.ioBtn}
                      onClick={() => void restoreRevision(r.id)}
                    >
                      还原
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </details>
          {renderInspector()}
          {error ? <p className={styles.error}>{error}</p> : null}
        </aside>
      </div>

      {assetsOpen ? (
        <div
          className={styles.assetOverlay}
          onClick={() => setAssetsOpen(false)}
        >
          <div className={styles.assetPanel} onClick={(e) => e.stopPropagation()}>
            <div className={styles.assetHead}>
              <strong>素材库</strong>
              <span className={styles.assetCount}>{assets.length}</span>
              <button
                type="button"
                className={styles.ioBtn}
                onClick={() => assetRef.current?.click()}
              >
                上传
              </button>
              <button
                type="button"
                className={styles.ioBtn}
                onClick={() => setAssetsOpen(false)}
              >
                关闭
              </button>
            </div>
            {assets.length === 0 ? (
              <p className={styles.muted}>还没有素材，先上传图片。</p>
            ) : (
              <div className={styles.assetGrid}>
                {assets.map((a) => (
                  <div key={a.id} className={styles.assetCell}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={a.url} alt={a.filename} />
                    <div className={styles.assetBtns}>
                      <button type="button" onClick={() => copyAsset(a.url)}>
                        复制链接
                      </button>
                      <button type="button" onClick={() => void removeAsset(a.id)}>
                        删除
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={assetRef}
              type="file"
              accept="image/*"
              hidden
              onChange={(e) => {
                void uploadAsset(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </div>
        </div>
      ) : null}

      {confirmState ? (
        <div
          className={styles.dialogBackdrop}
          role="dialog"
          aria-modal="true"
          onClick={() => setConfirmState(null)}
        >
          <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
            <p className={styles.dialogText}>{confirmState.message}</p>
            <div className={styles.dialogActions}>
              <button
                type="button"
                className={styles.ioBtn}
                onClick={() => setConfirmState(null)}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => {
                  const run = confirmState.onConfirm;
                  setConfirmState(null);
                  run();
                }}
              >
                确定
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {exportState ? (
        <div
          className={styles.dialogBackdrop}
          onClick={() => setExportState(null)}
        >
          <div
            className={styles.exportDialog}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={styles.exportHead}>
              <strong>{exportState.filename}</strong>
              <button type="button" className={styles.ioBtn} onClick={copyExport}>
                复制
              </button>
              <button
                type="button"
                className={styles.ioBtn}
                onClick={downloadExport}
              >
                下载文件
              </button>
              <button
                type="button"
                className={styles.confirmBtn}
                onClick={() => setExportState(null)}
              >
                关闭
              </button>
            </div>
            <textarea
              className={styles.exportText}
              readOnly
              spellCheck={false}
              value={exportState.json}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
