"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import {
  createEntry,
  createTimelineEvent,
  deleteEntry,
  deleteTimelineEvent,
  excerpt,
  fetchTagPresets,
  fetchWorldById,
  publishWorld,
  updateEntry,
  updateWorld,
  type TimelineEvent,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import { createWork, type WorkType } from "@/lib/works";
import EntrySlidePanel, {
  type EntryFormValue,
} from "@/components/world-editor/EntrySlidePanel";
import ImageUpload from "@/components/world-editor/ImageUpload";
import StylePanel from "@/components/world-editor/StylePanel";
import TimelineEditor from "@/components/world-editor/TimelineEditor";
import {
  normalizeHomepageConfig,
  type HomepageConfig,
} from "@/lib/homepage-config";
import styles from "./edit.module.css";

type SlideState =
  | { kind: "character" | "item"; entry?: WikiEntry }
  | null;

export default function EditWorldPage() {
  const params = useParams<{ id: string }>();
  const worldId = params.id;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [slide, setSlide] = useState<SlideState>(null);
  const [customTag, setCustomTag] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [workTitle, setWorkTitle] = useState("");
  const [workSummary, setWorkSummary] = useState("");
  const [workContent, setWorkContent] = useState("");
  const [workType, setWorkType] = useState<WorkType>("story");
  const [workBusy, setWorkBusy] = useState(false);
  const [workMsg, setWorkMsg] = useState<string | null>(null);

  const characters = useMemo(
    () => entries.filter((e) => e.category === "character"),
    [entries],
  );
  const items = useMemo(
    () => entries.filter((e) => e.category === "item"),
    [entries],
  );
  const intro = useMemo(
    () => entries.find((e) => e.category === "intro"),
    [entries],
  );

  const load = useCallback(async () => {
    const data = await fetchWorldById(worldId);
    if (!data.isOwner) {
      throw new Error("无权编辑此世界观");
    }
    setWorld(data.world);
    setNameDraft(data.world.name);
    setEntries(data.entries);
    setTimeline(data.timeline);
  }, [worldId]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    async function init() {
      try {
        const [tags] = await Promise.all([fetchTagPresets(), load()]);
        if (!cancelled) {
          setPresets(tags);
          setReady(true);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
          setReady(true);
        }
      }
    }
    void init();
    return () => {
      cancelled = true;
    };
  }, [load, router]);

  async function patchWorld(
    patch: Parameters<typeof updateWorld>[1],
  ): Promise<World | null> {
    if (!world) return null;
    setSaving(true);
    setError(null);
    try {
      // Flush pending name so later patches don't overwrite a typed-but-unsaved title.
      const pendingName = nameDraft.trim().slice(0, 80);
      const merged =
        pendingName &&
        pendingName !== world.name &&
        patch.name === undefined
          ? { ...patch, name: pendingName }
          : patch;

      const next = await updateWorld(world.id, merged);
      setWorld(next);
      setNameDraft(next.name);
      return next;
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveName(): Promise<boolean> {
    if (!world) return false;
    const name = nameDraft.trim().slice(0, 80);
    if (!name) {
      setNameDraft(world.name);
      setError("名称不能为空");
      return false;
    }
    if (name === world.name) return true;
    const next = await patchWorld({ name });
    return next != null;
  }

  async function saveIntro(content: string) {
    if (!world || !intro) {
      await patchWorld({ description: content.slice(0, 500) });
      return;
    }
    setSaving(true);
    try {
      const updated = await updateEntry(world.id, intro.id, { content });
      setEntries((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
      await updateWorld(world.id, {
        description: excerpt(content, 500).slice(0, 500),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存介绍失败");
    } finally {
      setSaving(false);
    }
  }

  function toggleTag(tag: string) {
    if (!world) return;
    const current = [...new Set(world.tags.filter(Boolean))];
    const has = current.includes(tag);
    const tags = has
      ? current.filter((t) => t !== tag)
      : [...current, tag].slice(0, 20);
    void patchWorld({ tags });
  }

  function addCustomTag() {
    const t = customTag.trim().slice(0, 32);
    if (!t || !world) return;
    const current = [...new Set(world.tags.filter(Boolean))];
    if (!current.includes(t)) {
      void patchWorld({ tags: [...current, t].slice(0, 20) });
    }
    setCustomTag("");
  }

  async function onSaveEntry(value: EntryFormValue) {
    if (!world || !slide) return;
    if (slide.entry) {
      const updated = await updateEntry(world.id, slide.entry.id, value);
      setEntries((prev) =>
        prev.map((e) => (e.id === updated.id ? updated : e)),
      );
    } else {
      const created = await createEntry(world.id, {
        category: slide.kind,
        ...value,
      });
      setEntries((prev) => [...prev, created]);
    }
  }

  async function onDeleteEntry(entryId: string) {
    if (!world) return;
    await deleteEntry(world.id, entryId);
    setEntries((prev) => prev.filter((e) => e.id !== entryId));
    if (slide?.entry?.id === entryId) setSlide(null);
  }

  async function onPublish() {
    if (!world) return;
    setPublishing(true);
    setError(null);
    try {
      const published = await publishWorld(world.id);
      router.push(`/w/${published.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布失败");
      setPublishing(false);
    }
  }

  async function onPublishWork() {
    if (!world) return;
    const title = workTitle.trim();
    if (!title) {
      setWorkMsg("请填写作品标题");
      return;
    }
    setWorkBusy(true);
    setWorkMsg(null);
    try {
      const work = await createWork({
        worldId: world.id,
        type: workType,
        title,
        summary: workSummary.trim() || undefined,
        content: workContent.trim() || undefined,
        publish: true,
      });
      setWorkTitle("");
      setWorkSummary("");
      setWorkContent("");
      setWorkMsg(
        world.status === "published"
          ? `已发布到广场：「${work.title}」`
          : `已创建「${work.title}」（世界观发布后才会出现在广场）`,
      );
    } catch (err) {
      setWorkMsg(err instanceof Error ? err.message : "发布作品失败");
    } finally {
      setWorkBusy(false);
    }
  }

  if (!ready) {
    return <p className={styles.loading}>加载编辑器…</p>;
  }

  if (!world) {
    return <p className={styles.error}>{error ?? "世界观不存在"}</p>;
  }

  return (
    <div className={`${styles.layout} ${slide ? styles.compressed : ""}`}>
      <div className={styles.main}>
        <section className={styles.hero}>
          <ImageUpload
            label="Logo"
            value={world.logoUrl}
            onChange={(url) => void patchWorld({ logoUrl: url })}
            aspect="square"
          />
          <div className={styles.heroFields}>
            <label className={styles.field}>
              <span>世界观名称</span>
              <input
                className={styles.nameInput}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                onBlur={() => void saveName()}
                maxLength={80}
              />
            </label>
            <label className={styles.field}>
              <span>基础介绍（Markdown）</span>
              <textarea
                rows={5}
                defaultValue={intro?.content ?? world.description}
                onBlur={(e) => void saveIntro(e.target.value)}
                placeholder="用几段话介绍这个世界的基调与核心设定…"
              />
            </label>
            <div className={styles.field}>
              <span>标签</span>
              <div className={styles.tags}>
                {presets.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className={
                      world.tags.includes(tag) ? styles.tagOn : styles.tag
                    }
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </button>
                ))}
                {world.tags
                  .filter((t) => !presets.includes(t))
                  .map((tag) => (
                    <button
                      key={tag}
                      type="button"
                      className={styles.tagOn}
                      onClick={() => toggleTag(tag)}
                    >
                      {tag} ×
                    </button>
                  ))}
                <div className={styles.tagCustom}>
                  <input
                    value={customTag}
                    onChange={(e) => setCustomTag(e.target.value)}
                    placeholder="自定义"
                    maxLength={32}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        addCustomTag();
                      }
                    }}
                  />
                  <button type="button" onClick={addCustomTag}>
                    添加
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className={styles.bgRow}>
          <ImageUpload
            label="Wiki 背景图"
            value={world.wikiBackgroundUrl}
            onChange={(url) => void patchWorld({ wikiBackgroundUrl: url })}
            aspect="wide"
          />
        </div>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>人物</h2>
            <button
              type="button"
              className={styles.plus}
              aria-label="添加人物"
              onClick={() => setSlide({ kind: "character" })}
            >
              +
            </button>
          </div>
          {characters.length === 0 ? (
            <p className={styles.emptyHint}>点击 + 添加人物</p>
          ) : (
            <div className={styles.grid}>
              {characters.map((c) => (
                <article key={c.id} className={styles.card}>
                  <button
                    type="button"
                    className={styles.cardHit}
                    onClick={() => setSlide({ kind: "character", entry: c })}
                  >
                    {c.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={c.imageUrl} alt="" className={styles.thumb} />
                    ) : (
                      <div className={styles.thumbEmpty}>无立绘</div>
                    )}
                    <div className={styles.cardBody}>
                      <strong>{c.title}</strong>
                      <p>{excerpt(c.content) || "暂无介绍"}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.cardDel}
                    onClick={() => void onDeleteEntry(c.id)}
                  >
                    删除
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <h2>物品</h2>
            <button
              type="button"
              className={styles.plus}
              aria-label="添加物品"
              onClick={() => setSlide({ kind: "item" })}
            >
              +
            </button>
          </div>
          {items.length === 0 ? (
            <p className={styles.emptyHint}>点击 + 添加物品</p>
          ) : (
            <div className={styles.grid}>
              {items.map((it) => (
                <article key={it.id} className={styles.card}>
                  <button
                    type="button"
                    className={styles.cardHit}
                    onClick={() => setSlide({ kind: "item", entry: it })}
                  >
                    {it.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={it.imageUrl} alt="" className={styles.thumb} />
                    ) : (
                      <div className={styles.thumbEmpty}>无图片</div>
                    )}
                    <div className={styles.cardBody}>
                      <strong>{it.title}</strong>
                      <p>{excerpt(it.content) || "暂无介绍"}</p>
                    </div>
                  </button>
                  <button
                    type="button"
                    className={styles.cardDel}
                    onClick={() => void onDeleteEntry(it.id)}
                  >
                    删除
                  </button>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className={styles.section}>
          <TimelineEditor
            events={timeline}
            onCreate={async (input) => {
              if (!world) return;
              const ev = await createTimelineEvent(world.id, input);
              setTimeline((prev) => [...prev, ev]);
            }}
            onDelete={async (eventId) => {
              if (!world) return;
              await deleteTimelineEvent(world.id, eventId);
              setTimeline((prev) => prev.filter((e) => e.id !== eventId));
            }}
          />
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>发布作品</h2>
              <p className={styles.sectionLead}>
                作品会出现在广场流中（需世界观已公开发布）。
              </p>
            </div>
          </div>
          <div className={styles.workForm}>
            <label className={styles.field}>
              <span>类型</span>
              <select
                value={workType}
                onChange={(e) => setWorkType(e.target.value as WorkType)}
              >
                <option value="story">短篇</option>
                <option value="novel">长篇</option>
                <option value="chapter">章节</option>
                <option value="artwork">美术</option>
                <option value="other">其他</option>
              </select>
            </label>
            <label className={styles.field}>
              <span>标题</span>
              <input
                value={workTitle}
                onChange={(e) => setWorkTitle(e.target.value)}
                maxLength={200}
                placeholder="作品名称"
              />
            </label>
            <label className={styles.field}>
              <span>摘要</span>
              <input
                value={workSummary}
                onChange={(e) => setWorkSummary(e.target.value)}
                maxLength={500}
                placeholder="列表里显示的一句话"
              />
            </label>
            <label className={styles.field}>
              <span>正文（Markdown）</span>
              <textarea
                rows={6}
                value={workContent}
                onChange={(e) => setWorkContent(e.target.value)}
                placeholder="故事正文…"
              />
            </label>
            <div className={styles.workActions}>
              <button
                type="button"
                className={styles.publish}
                disabled={workBusy}
                onClick={() => void onPublishWork()}
              >
                {workBusy ? "发布中…" : "发布到广场"}
              </button>
              {workMsg ? <span className={styles.workMsg}>{workMsg}</span> : null}
            </div>
          </div>
        </section>

        <section className={styles.section}>
          <StylePanel
            value={normalizeHomepageConfig(world.homepageConfig)}
            onChange={(homepageConfig: HomepageConfig) => {
              setWorld({ ...world, homepageConfig });
              void patchWorld({ homepageConfig });
            }}
          />
        </section>

        <div className={styles.footerBar}>
          <span className={styles.status}>
            {saving ? "保存中…" : world.status === "draft" ? "草稿已自动保存" : "已发布"}
            {error ? ` · ${error}` : null}
          </span>
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.saveExit}
              disabled={saving || publishing}
              onClick={() => {
                void (async () => {
                  const ok = await saveName();
                  if (ok) router.push("/worlds");
                })();
              }}
            >
              保存并返回
            </button>
            <button
              type="button"
              className={styles.publish}
              disabled={publishing || saving}
              onClick={() => {
                void (async () => {
                  const ok = await saveName();
                  if (ok) await onPublish();
                })();
              }}
            >
              {publishing ? "发布中…" : "发布世界观"}
            </button>
          </div>
        </div>
      </div>

      {slide ? (
        <EntrySlidePanel
          kind={slide.kind}
          initial={
            slide.entry
              ? {
                  title: slide.entry.title,
                  content: slide.entry.content,
                  imageUrl: slide.entry.imageUrl,
                }
              : undefined
          }
          onSave={onSaveEntry}
          onClose={() => setSlide(null)}
        />
      ) : null}
    </div>
  );
}
