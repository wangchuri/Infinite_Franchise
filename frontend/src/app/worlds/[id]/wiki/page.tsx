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
import { BLOCK_META, SLOT_LABELS, SLOT_ORDER } from "@/lib/block-meta";
import { entryAttributeFields } from "@/lib/entry-schema";
import BlockFields from "@/components/world-blocks/BlockFields";
import ImageUpload from "@/components/world-editor/ImageUpload";
import {
  createCollection,
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
  type VariantMatchOp,
  type WorldLayout,
} from "@/lib/world-layout";
import {
  createWorldPage,
  fetchWorldById,
  updateWorld,
  updateWorldPage,
  uploadFont,
  uploadImage,
  type TimelineEvent,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import styles from "./wiki-editor.module.css";

const FRAME_W = 1280;
const FRAME_H = 800;
const FRAME_GUTTER = 32;

const VARIANT_BLOCKS = new Set<BlockType>(["entryGrid", "glossary"]);

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
  const [previewKey, setPreviewKey] = useState(0);
  const [availW, setAvailW] = useState(0);
  const [availH, setAvailH] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

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
        const home = data.pages.find((p) => p.kind === "home");
        if (home) {
          setPageId(home.id);
          if (home.layout.blocks.length) {
            setLayout(home.layout);
          } else {
            setLayout(buildDefaultLayout());
            setDirty(true);
          }
        } else {
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
            await updateWorldPage(world.id, pageId, { layout });
          } else {
            const created = await createWorldPage(world.id, {
              kind: "home",
              layout,
            });
            setPageId(created.id);
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
  }, [dirty, layout, world, pageId]);

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

  const usingSample = entries.length === 0 || timeline.length === 0;
  const fit = Math.min(
    (availW - FRAME_GUTTER) / FRAME_W,
    (availH - FRAME_GUTTER) / FRAME_H,
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
      if (b.type === "columns" && b.slots) {
        return (
          <div key={b.id} className={styles.group}>
            <button
              type="button"
              className={b.id === selectedId ? styles.groupHeadOn : styles.groupHead}
              onClick={() => selectBlock(b.id)}
            >
              {BLOCK_META.columns?.label}
            </button>
            {SLOT_ORDER.filter((k) => b.slots?.[k]).map((k) => (
              <div key={k} className={styles.slot}>
                <div className={styles.slotHead}>
                  <span>{SLOT_LABELS[k]}</span>
                  <AddRegionMenu onAdd={(t) => onAdd(b.id, k, t)} />
                </div>
                {(b.slots?.[k] ?? []).map((child) => renderRow(child, 1))}
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
        <strong className={styles.docName}>{world.name} · Wiki 界面</strong>
        {usingSample ? (
          <span className={styles.sampleBadge} title="空区域以示例数据呈现">
            示例数据
          </span>
        ) : null}
        <span className={styles.saveState}>
          {saving ? "保存中…" : dirty ? "未保存" : savedAt ? "已保存" : ""}
        </span>
      </header>

      <div className={styles.body}>
        <aside className={styles.paneLeft}>
          <p className={styles.paneTitle}>结构 / Hierarchy</p>
          <div className={styles.tree}>{renderHierarchy(layout.blocks)}</div>
        </aside>

        <div className={styles.paneCenter}>
          <div className={styles.canvasBar}>
            <span>预览 · 标准 Web 视图</span>
            <span className={styles.canvasHint}>点击预览或左侧结构选中区域</span>
            <span className={styles.zoom}>{Math.round(scale * 100)}%</span>
          </div>
          <div className={styles.canvasViewport} ref={viewportRef}>
            <div
              className={styles.deviceWrap}
              style={{ width: FRAME_W * scale, height: FRAME_H * scale }}
            >
              <div
                className={styles.device}
                style={{
                  width: FRAME_W,
                  height: FRAME_H,
                  transform: `scale(${scale})`,
                }}
              >
                <div className={styles.deviceBar}>
                  <span className={styles.dots}>
                    <i />
                    <i />
                    <i />
                  </span>
                  <span className={styles.deviceUrl}>/w/{world.slug}/wiki</span>
                </div>
                <iframe
                  ref={iframeRef}
                  className={styles.deviceFrame}
                  src={`/w/${world.slug}/wiki?preview=1&v=${previewKey}`}
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
          {renderInspector()}
          {error ? <p className={styles.error}>{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}
