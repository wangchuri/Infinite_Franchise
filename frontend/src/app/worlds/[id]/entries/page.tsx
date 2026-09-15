"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { BLOCK_META } from "@/lib/block-meta";
import { collectionName, type WorldCollection } from "@/lib/collections";
import { entryAttributeFields } from "@/lib/entry-schema";
import {
  CONTENT_BLOCK_TYPES,
  type Block,
  type BlockType,
  type EntryLayout,
  type EntryLayoutMode,
} from "@/lib/world-layout";
import {
  insertBlockAt,
  moveBlockToIndex,
  newBlockId,
} from "@/lib/layout-edit";
import BlockFields from "@/components/world-blocks/BlockFields";
import ImageUpload from "@/components/world-editor/ImageUpload";
import {
  createEntry,
  deleteEntry,
  fetchWorldById,
  updateEntry,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import CollectionManager from "./CollectionManager";
import styles from "./entries.module.css";

const FRAME_W = 1280;
const FRAME_H = 800;
const FRAME_GUTTER = 32;

type Draft = {
  id: string;
  slug: string;
  title: string;
  content: string;
  contentLayout: EntryLayout;
  imageUrl: string | null;
  category: string;
  attributes: Record<string, string>;
};

type DragState =
  | { kind: "move"; id: string }
  | { kind: "new"; type: BlockType }
  | null;

const EMPTY_LAYOUT: EntryLayout = { version: 2, mode: "two", blocks: [] };

function toDraft(e: WikiEntry): Draft {
  return {
    id: e.id,
    slug: e.slug,
    title: e.title,
    content: e.content,
    contentLayout: e.contentLayout ?? EMPTY_LAYOUT,
    imageUrl: e.imageUrl,
    category: e.category,
    attributes: { ...e.attributes },
  };
}

function makeBlock(type: BlockType): Block {
  const meta = BLOCK_META[type];
  const block: Block = { id: newBlockId(type), type };
  if (meta?.defaultProps) block.props = { ...meta.defaultProps };
  return block;
}

function blockHint(block: Block): string {
  const p = block.props ?? {};
  if (typeof p.title === "string" && p.title) return p.title;
  if (typeof p.text === "string" && p.text) return p.text;
  if (typeof p.markdown === "string" && p.markdown) {
    return p.markdown.replace(/\s+/g, " ").slice(0, 24);
  }
  if (typeof p.caption === "string" && p.caption) return p.caption;
  if (typeof p.label === "string" && p.label) return p.label;
  return "";
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

export default function EntryLibraryPage() {
  const params = useParams<{ id: string }>();
  const worldId = params.id;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [collections, setCollections] = useState<WorldCollection[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [managing, setManaging] = useState(false);
  const [tab, setTab] = useState<"props" | "components">("props");
  const [selectedBlockId, setSelectedBlockId] = useState<string>("");
  const [drag, setDrag] = useState<DragState>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [saving, setSaving] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [adding, setAdding] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const [availW, setAvailW] = useState(0);
  const [availH, setAvailH] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchWorldById(worldId);
        if (!data.isOwner) throw new Error("无权编辑此世界观");
        if (cancelled) return;
        setWorld(data.world);
        setEntries(data.entries);
        setCollections(data.collections);
        const first = data.collections[0]?.key ?? "";
        setActiveCategory(first);
        const entry = data.entries.find((e) => e.category === first);
        setDraft(entry ? toDraft(entry) : null);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
  }, [router]);

  const counts = useMemo(() => {
    const out: Record<string, number> = {};
    for (const e of entries) out[e.category] = (out[e.category] ?? 0) + 1;
    return out;
  }, [entries]);

  const list = useMemo(
    () => entries.filter((e) => e.category === activeCategory),
    [entries, activeCategory],
  );

  const blocks = useMemo(
    () => draft?.contentLayout.blocks ?? [],
    [draft],
  );
  const blockIds = useMemo(() => new Set(blocks.map((b) => b.id)), [blocks]);

  // Debounced autosave of the current draft.
  useEffect(() => {
    if (!dirty || !draft || !world) return;
    const t = window.setTimeout(() => {
      void (async () => {
        setSaving(true);
        try {
          const next = await updateEntry(world.id, draft.id, {
            title: draft.title.trim() || "未命名词条",
            content: draft.content,
            contentLayout: draft.contentLayout,
            imageUrl: draft.imageUrl,
            category: draft.category,
            attributes: draft.attributes,
          });
          setEntries((prev) => prev.map((e) => (e.id === next.id ? next : e)));
          setSavedAt(Date.now());
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
  }, [dirty, draft, world]);

  // Track preview viewport size for scaling the device frame.
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
  }, [ready, draft?.id]);

  useEffect(() => {
    const doc = iframeRef.current?.contentDocument;
    if (doc && doc.readyState !== "loading") applyHighlight(doc, selectedBlockId);
  }, [selectedBlockId, previewKey]);

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
            setSelectedBlockId(cur.id);
            setTab("props");
            return;
          }
          cur = cur.parentElement;
        }
      },
      true,
    );
    applyHighlight(doc, selectedBlockId);
  }

  function patchDraft(patch: Partial<Draft>) {
    setDraft((prev) => (prev ? { ...prev, ...patch } : prev));
    setDirty(true);
  }

  function setBlocks(nextBlocks: Block[]) {
    if (!draft) return;
    patchDraft({ contentLayout: { ...draft.contentLayout, blocks: nextBlocks } });
  }

  function selectCategory(key: string) {
    setActiveCategory(key);
    const entry = entries.find((e) => e.category === key);
    setDraft(entry ? toDraft(entry) : null);
    setDirty(false);
    setAdding(false);
    setConfirmDelete(false);
    setSelectedBlockId("");
  }

  function selectEntry(id: string) {
    const entry = entries.find((e) => e.id === id);
    setDraft(entry ? toDraft(entry) : null);
    setDirty(false);
    setAdding(false);
    setConfirmDelete(false);
    setSelectedBlockId("");
  }

  async function commitAddEntry() {
    if (!world) return;
    const key = activeCategory || collections[0]?.key;
    if (!key) {
      setError("请先创建一个归属");
      return;
    }
    const title = newTitle.trim();
    if (!title) return;
    try {
      const created = await createEntry(world.id, {
        category: key,
        title,
        attributes: {},
      });
      setEntries((prev) => [...prev, created]);
      setDraft(toDraft(created));
      setDirty(false);
      setAdding(false);
      setNewTitle("");
      setSelectedBlockId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function removeEntry(id: string) {
    if (!world) return;
    try {
      await deleteEntry(world.id, id);
      const rest = entries.filter((e) => e.id !== id);
      setEntries(rest);
      const next = rest.find((e) => e.category === activeCategory) ?? null;
      setDraft(next ? toDraft(next) : null);
      setDirty(false);
      setConfirmDelete(false);
      setSelectedBlockId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  function addBlock(type: BlockType, index?: number) {
    if (!draft) return;
    const block = makeBlock(type);
    setBlocks(
      index === undefined
        ? [...blocks, block]
        : insertBlockAt(blocks, index, block),
    );
    setSelectedBlockId(block.id);
    setTab("props");
  }

  function onDrop(index: number) {
    if (!draft || !drag) return;
    if (drag.kind === "new") addBlock(drag.type, index);
    else setBlocks(moveBlockToIndex(blocks, drag.id, index));
    setDrag(null);
    setDropIndex(null);
  }

  function updateBlockProp(id: string, key: string, value: unknown) {
    setBlocks(
      blocks.map((b) =>
        b.id === id ? { ...b, props: { ...(b.props ?? {}), [key]: value } } : b,
      ),
    );
  }

  function removeBlock(id: string) {
    setBlocks(blocks.filter((b) => b.id !== id));
    if (selectedBlockId === id) setSelectedBlockId("");
  }

  function convertMarkdown() {
    if (!draft) return;
    const block = makeBlock("text");
    block.props = { markdown: draft.content };
    patchDraft({ contentLayout: { ...draft.contentLayout, blocks: [block] } });
    setSelectedBlockId(block.id);
  }

  if (!ready) return <p className={styles.loading}>加载词条库…</p>;
  if (!world) return <p className={styles.error}>{error ?? "世界观不存在"}</p>;

  const attrFields = draft
    ? entryAttributeFields(draft.category, collections)
    : [];
  const selectedBlock = blocks.find((b) => b.id === selectedBlockId) ?? null;

  const fit = Math.min(
    (availW - FRAME_GUTTER) / FRAME_W,
    (availH - FRAME_GUTTER) / FRAME_H,
  );
  const scale = availW > 0 && availH > 0 ? Math.max(0.1, Math.min(1, fit)) : 1;

  function renderBlockRow(block: Block, index: number): ReactNode {
    const on = block.id === selectedBlockId;
    const hint = blockHint(block);
    return (
      <div
        key={block.id}
        className={[
          on ? styles.rowOn : styles.row,
          dropIndex === index ? styles.dropBefore : "",
          dropIndex === index + 1 ? styles.dropAfter : "",
        ]
          .filter(Boolean)
          .join(" ")}
        draggable
        onClick={() => {
          setSelectedBlockId(block.id);
          setTab("props");
        }}
        onDragStart={(e) => {
          setDrag({ kind: "move", id: block.id });
          e.dataTransfer.effectAllowed = "move";
          e.dataTransfer.setData("text/plain", block.id);
        }}
        onDragEnd={() => {
          setDrag(null);
          setDropIndex(null);
        }}
        onDragOver={(e) => {
          if (!drag) return;
          e.preventDefault();
          e.stopPropagation();
          const rect = e.currentTarget.getBoundingClientRect();
          const isAfter = e.clientY > rect.top + rect.height / 2;
          setDropIndex(isAfter ? index + 1 : index);
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onDrop(dropIndex ?? index);
        }}
      >
        <span className={styles.grip} aria-hidden="true">
          ⠿
        </span>
        <span className={styles.rowLabel}>
          <span className={styles.rowType}>
            {BLOCK_META[block.type]?.label ?? block.type}
          </span>
          {hint ? <span className={styles.rowTitle}>{hint}</span> : null}
        </span>
        <button
          type="button"
          className={styles.rowDel}
          aria-label="删除"
          onClick={(e) => {
            e.stopPropagation();
            removeBlock(block.id);
          }}
        >
          ×
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
        <strong className={styles.docName}>{world.name} · 词条库</strong>
        <span className={styles.saveState}>
          {saving ? "保存中…" : dirty ? "未保存" : savedAt ? "已保存" : ""}
        </span>
      </header>

      <div className={styles.body}>
        <aside className={styles.paneLeft}>
          <div className={styles.paneHead}>
            <span>归属</span>
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => setManaging((v) => !v)}
            >
              {managing ? "返回词条" : "管理归属"}
            </button>
          </div>

          {managing ? (
            <CollectionManager
              worldId={world.id}
              collections={collections}
              counts={counts}
              onChange={setCollections}
              onError={setError}
            />
          ) : (
            <>
              <div className={styles.tabs}>
                {collections.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={c.key === activeCategory ? styles.tabOn : styles.tab}
                    onClick={() => selectCategory(c.key)}
                  >
                    {c.name}
                    <span className={styles.tabCount}>{counts[c.key] ?? 0}</span>
                  </button>
                ))}
              </div>

              {adding ? (
                <div className={styles.inlineCreate}>
                  <input
                    autoFocus
                    value={newTitle}
                    placeholder="词条名称"
                    onChange={(e) => setNewTitle(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") void commitAddEntry();
                      else if (e.key === "Escape") {
                        setAdding(false);
                        setNewTitle("");
                      }
                    }}
                  />
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => void commitAddEntry()}
                  >
                    确定
                  </button>
                  <button
                    type="button"
                    className={styles.miniBtn}
                    onClick={() => {
                      setAdding(false);
                      setNewTitle("");
                    }}
                  >
                    取消
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className={styles.addBtn}
                  onClick={() => {
                    setAdding(true);
                    setNewTitle("");
                  }}
                >
                  + 新建词条
                </button>
              )}

              <div className={styles.itemList}>
                {list.length === 0 ? (
                  <p className={styles.muted}>该归属下还没有词条。</p>
                ) : (
                  list.map((e) => (
                    <button
                      key={e.id}
                      type="button"
                      className={e.id === draft?.id ? styles.itemOn : styles.item}
                      onClick={() => selectEntry(e.id)}
                    >
                      {e.title}
                    </button>
                  ))
                )}
              </div>
            </>
          )}
        </aside>

        <section className={styles.paneCenter}>
          {!draft ? (
            <p className={styles.centerEmpty}>选择或新建一个词条开始编辑。</p>
          ) : (
            <>
              <div className={styles.entryHeader}>
                <input
                  className={styles.titleInput}
                  value={draft.title}
                  maxLength={120}
                  placeholder="词条名称"
                  onChange={(e) => patchDraft({ title: e.target.value })}
                />
              </div>

              <div className={styles.editorBody}>
                <div className={styles.structure}>
                  <p className={styles.paneTitle}>结构 / Hierarchy</p>
                  <div
                    className={
                      drag && blocks.length === 0
                        ? styles.treeDrag
                        : styles.tree
                    }
                    onDragOver={(e) => {
                      if (!drag) return;
                      e.preventDefault();
                      if (dropIndex === null) setDropIndex(blocks.length);
                    }}
                    onDrop={(e) => {
                      e.preventDefault();
                      onDrop(dropIndex ?? blocks.length);
                    }}
                  >
                    {blocks.map((b, i) => renderBlockRow(b, i))}
                    {blocks.length === 0 ? (
                      <div className={styles.treeEmpty}>
                        {draft.content.trim() ? (
                          <>
                            <p>当前使用 Markdown 正文。</p>
                            <button
                              type="button"
                              className={styles.miniBtn}
                              onClick={convertMarkdown}
                            >
                              转为内容块
                            </button>
                          </>
                        ) : (
                          <p>从右侧「组件」拖入或点击添加。</p>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>

                <div className={styles.previewPane}>
                  <div className={styles.canvasBar}>
                    <span>预览 · 标准 Web 视图</span>
                    <span className={styles.zoom}>
                      {Math.round(scale * 100)}%
                    </span>
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
                          <span className={styles.deviceUrl}>
                            /w/{world.slug}/entry/{draft.slug}
                          </span>
                        </div>
                        <iframe
                          ref={iframeRef}
                          className={styles.deviceFrame}
                          src={`/w/${world.slug}/entry/${encodeURIComponent(
                            draft.slug,
                          )}?preview=1&v=${previewKey}`}
                          title="词条预览"
                          onLoad={onFrameLoad}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </>
          )}
        </section>

        <aside className={styles.paneRight}>
          <div className={styles.tabsRow}>
            <button
              type="button"
              className={tab === "props" ? styles.tabOn : styles.tab}
              onClick={() => setTab("props")}
            >
              属性
            </button>
            <button
              type="button"
              className={tab === "components" ? styles.tabOn : styles.tab}
              onClick={() => setTab("components")}
            >
              组件
            </button>
          </div>

          {tab === "components" ? (
            <div className={styles.libGrid}>
              {CONTENT_BLOCK_TYPES.filter(
                (t) => BLOCK_META[t] !== undefined,
              ).map((t) => (
                <div
                  key={t}
                  role="button"
                  tabIndex={0}
                  className={styles.libItem}
                  draggable
                  onDragStart={(e) => {
                    setDrag({ kind: "new", type: t });
                    e.dataTransfer.effectAllowed = "copy";
                    e.dataTransfer.setData("text/plain", t);
                  }}
                  onDragEnd={() => {
                    setDrag(null);
                    setDropIndex(null);
                  }}
                  onClick={() => addBlock(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") addBlock(t);
                  }}
                >
                  {BLOCK_META[t]?.label ?? t}
                </div>
              ))}
            </div>
          ) : !draft ? (
            <p className={styles.muted}>未选择词条。</p>
          ) : selectedBlock ? (
            <>
              <button
                type="button"
                className={styles.linkBtn}
                onClick={() => setSelectedBlockId("")}
              >
                ← 返回词条属性
              </button>
              <div className={styles.subHead}>
                {BLOCK_META[selectedBlock.type]?.label ?? selectedBlock.type}
              </div>
              <BlockFields
                block={selectedBlock}
                onChange={(key, value) =>
                  updateBlockProp(selectedBlock.id, key, value)
                }
                collections={collections}
                entries={entries}
                onError={setError}
              />
            </>
          ) : (
            <>
              <ImageUpload
                label="封面图"
                value={draft.imageUrl}
                onChange={(url) => patchDraft({ imageUrl: url })}
                aspect="wide"
              />

              <label className={styles.field}>
                <span>页面布局</span>
                <select
                  value={draft.contentLayout.mode ?? "two"}
                  onChange={(e) =>
                    patchDraft({
                      contentLayout: {
                        ...draft.contentLayout,
                        mode: e.target.value as EntryLayoutMode,
                      },
                    })
                  }
                >
                  <option value="two">两栏（右侧信息卡）</option>
                  <option value="one">单栏</option>
                </select>
              </label>

              <label className={styles.field}>
                <span>归属</span>
                <select
                  value={draft.category}
                  onChange={(e) => patchDraft({ category: e.target.value })}
                >
                  {collections.map((c) => (
                    <option key={c.id} value={c.key}>
                      {c.name}
                      {c.hidden ? "（隐藏）" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <div className={styles.subHead}>额外属性</div>
              {attrFields.length === 0 ? (
                <p className={styles.muted}>
                  该归属暂无额外属性，可在「管理归属」中添加。
                </p>
              ) : (
                attrFields.map((f) => (
                  <label key={f.key} className={styles.field}>
                    <span>{f.label}</span>
                    <input
                      value={draft.attributes[f.key] ?? ""}
                      onChange={(e) =>
                        patchDraft({
                          attributes: {
                            ...draft.attributes,
                            [f.key]: e.target.value,
                          },
                        })
                      }
                    />
                  </label>
                ))
              )}

              <div className={styles.actions}>
                {confirmDelete ? (
                  <span className={styles.confirmRow}>
                    删除该词条？
                    <button
                      type="button"
                      className={styles.miniBtn}
                      onClick={() => void removeEntry(draft.id)}
                    >
                      确定
                    </button>
                    <button
                      type="button"
                      className={styles.miniBtn}
                      onClick={() => setConfirmDelete(false)}
                    >
                      取消
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    className={styles.dangerBtn}
                    onClick={() => setConfirmDelete(true)}
                  >
                    删除词条
                  </button>
                )}
                <span className={styles.muted}>
                  {collectionName(collections, draft.category)}
                </span>
              </div>
            </>
          )}
          {error ? <p className={styles.error}>{error}</p> : null}
        </aside>
      </div>
    </div>
  );
}
