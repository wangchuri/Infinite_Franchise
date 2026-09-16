"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import WikiTiles from "@/components/WikiTiles";
import CollabPanel from "@/components/world-editor/CollabPanel";
import ImageUpload from "@/components/world-editor/ImageUpload";
import { getAccessToken } from "@/lib/auth";
import { usePageLabel } from "@/lib/nav-trail";
import {
  excerpt,
  fetchTagPresets,
  fetchWorldById,
  publishWorld,
  updateEntry,
  updateWorld,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import styles from "./edit.module.css";

export default function EditWorldPage() {
  const params = useParams<{ id: string }>();
  const worldId = params.id;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState("");
  const [nameDraft, setNameDraft] = useState("");
  const [taglineDraft, setTaglineDraft] = useState("");
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  /** Set while a Wiki tile is waiting for the unsaved-changes prompt. */
  const [pendingHref, setPendingHref] = useState<string | null>(null);

  usePageLabel(world?.name ?? null);

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
    setTaglineDraft(data.world.tagline);
    setEntries(data.entries);
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

  async function saveTagline() {
    if (!world) return;
    const tagline = taglineDraft.trim().slice(0, 140);
    if (tagline === world.tagline) return;
    await patchWorld({ tagline });
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

  const hasUnsaved = world
    ? nameDraft.trim() !== world.name || taglineDraft.trim() !== world.tagline
    : false;

  function handleTileNavigate(href: string): boolean {
    if (!hasUnsaved) return true;
    setPendingHref(href);
    return false;
  }

  async function saveAndGo() {
    const href = pendingHref;
    if (!href) return;
    const ok = await saveName();
    if (!ok) return;
    await saveTagline();
    setPendingHref(null);
    router.push(href);
  }

  function goWithoutSaving() {
    const href = pendingHref;
    setPendingHref(null);
    if (href) router.push(href);
  }

  if (!ready) {
    return <p className={styles.loading}>加载编辑器…</p>;
  }

  if (!world) {
    return <p className={styles.error}>{error ?? "世界观不存在"}</p>;
  }

  return (
    <div className={styles.layout}>
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
              <span>一句话简介</span>
              <input
                value={taglineDraft}
                onChange={(e) => setTaglineDraft(e.target.value)}
                onBlur={() => void saveTagline()}
                maxLength={140}
                placeholder="用一句话点出这个世界的基调"
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

        <section className={styles.section}>
          <div className={styles.sectionHead}>
            <div>
              <h2>Wiki 内容</h2>
              <p className={styles.sectionLead}>
                归属与词条、Wiki 主页排版各自独立维护。
              </p>
            </div>
          </div>
          <WikiTiles worldId={world.id} onNavigate={handleTileNavigate} />
        </section>

        <section className={styles.section}>
          <CollabPanel
            worldId={world.id}
            currentMode={world.workSubmitMode}
            onModeChange={(workSubmitMode) =>
              void patchWorld({ workSubmitMode })
            }
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

      {pendingHref ? (
        <div
          className={styles.modalBackdrop}
          role="dialog"
          aria-modal="true"
          aria-label="未保存的修改"
          onClick={() => setPendingHref(null)}
        >
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h2>有未保存的修改</h2>
            <p>进入 Wiki 编辑前，是否先保存当前进度？</p>
            <div className={styles.modalActions}>
              <button
                type="button"
                className={styles.saveExit}
                onClick={() => setPendingHref(null)}
              >
                取消
              </button>
              <button
                type="button"
                className={styles.saveExit}
                onClick={goWithoutSaving}
              >
                不保存，直接进入
              </button>
              <button
                type="button"
                className={styles.publish}
                onClick={() => void saveAndGo()}
              >
                保存并进入
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
