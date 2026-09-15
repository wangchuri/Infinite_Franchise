"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import type { WorldCollection } from "@/lib/collections";
import {
  fetchContributableWorlds,
  fetchWorldBySlug,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import {
  createWork,
  deleteWork,
  fetchWorkById,
  updateWork,
} from "@/lib/works";
import { WORK_KINDS, type WorkCategory } from "@/lib/work-taxonomy";
import MarkdownView from "@/components/MarkdownView";
import MarkdownEditor from "@/components/world-blocks/MarkdownEditor";
import ImageUpload from "@/components/world-editor/ImageUpload";
import styles from "./workbench.module.css";

const LABELS: Record<string, string> = {
  novel: "小说",
  artwork: "美术",
  program: "程序",
  audio: "音频",
  video: "视频",
  other: "创作",
};

export type WorkbenchPrefill = {
  kind?: string;
  title?: string;
  summary?: string;
  mediaUrl?: string | null;
};

export default function Workbench({
  initialCategory,
  workId,
  prefill,
}: {
  initialCategory: WorkCategory;
  workId?: string;
  prefill?: WorkbenchPrefill;
}) {
  const router = useRouter();
  const isEdit = Boolean(workId);

  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState("");
  const [worldName, setWorldName] = useState("");
  const [worldSlug, setWorldSlug] = useState("");
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [collections, setCollections] = useState<WorldCollection[]>([]);
  const [category, setCategory] = useState<WorkCategory>(initialCategory);
  const [kind, setKind] = useState(prefill?.kind ?? "");
  const [title, setTitle] = useState(prefill?.title ?? "");
  const [summary, setSummary] = useState(prefill?.summary ?? "");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState<string | null>(
    prefill?.mediaUrl ?? null,
  );
  const [status, setStatus] = useState<string>("draft");
  const [fileName, setFileName] = useState("");
  const [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(!isEdit);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const label = LABELS[category] ?? "创作";
  const kinds = WORK_KINDS[category] ?? [];

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;

    if (workId) {
      void (async () => {
        try {
          const w = await fetchWorkById(workId);
          if (cancelled) return;
          setWorldId(w.worldId);
          setWorldName(w.worldName);
          setWorldSlug(w.worldSlug);
          setCategory(w.category);
          setKind(w.kind ?? "");
          setTitle(w.title);
          setSummary(w.summary ?? "");
          setContent(w.content ?? "");
          setMediaUrl(w.mediaUrl);
          setStatus(w.status);
        } catch (err) {
          if (!cancelled) {
            setError(err instanceof Error ? err.message : "加载失败");
          }
        } finally {
          if (!cancelled) setReady(true);
        }
      })();
    } else {
      void (async () => {
        try {
          const list = await fetchContributableWorlds();
          if (cancelled) return;
          setWorlds(list);
          setWorldId((prev) => prev || list[0]?.id || "");
        } catch {
          /* ignore */
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, [router, workId]);

  /** Slug of the world being written for (create picks it from the select). */
  const activeSlug = isEdit
    ? worldSlug
    : (worlds.find((w) => w.id === worldId)?.slug ?? "");

  // Provide the world's entries so `[[词条名]]` works in the editor + preview.
  useEffect(() => {
    if (!activeSlug) return;
    let cancelled = false;
    void (async () => {
      try {
        const world = await fetchWorldBySlug(activeSlug);
        if (cancelled) return;
        setEntries(world.entries);
        setCollections(world.collections);
      } catch {
        /* keep whatever we had */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [activeSlug]);

  async function onUpload(file: File | undefined) {
    if (!file) return;
    try {
      const text = await file.text();
      setContent((prev) => (prev.trim() ? `${prev.trim()}\n\n${text}` : text));
      setFileName(file.name);
      setError(null);
    } catch {
      setError("读取文件失败");
    }
  }

  async function submit(publish: boolean) {
    if (!title.trim()) {
      setError("请填写标题");
      return;
    }
    setBusy(true);
    setError(null);
    const nextStatus = publish ? "published" : "draft";
    try {
      if (workId) {
        await updateWork(workId, {
          kind: kind || undefined,
          title: title.trim(),
          summary: summary.trim() || null,
          content: content.trim() || null,
          mediaUrl,
          status: nextStatus,
        });
        router.push(`/works/${workId}`);
      } else {
        if (!worldId) {
          setError("请选择归属世界");
          setBusy(false);
          return;
        }
        const work = await createWork({
          worldId,
          category,
          kind: kind || undefined,
          title: title.trim(),
          summary: summary.trim() || undefined,
          content: content.trim() || undefined,
          mediaUrl,
          publish,
        });
        router.push(`/works/${work.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "提交失败");
      setBusy(false);
    }
  }

  async function remove() {
    if (!workId) return;
    setBusy(true);
    try {
      await deleteWork(workId);
      router.push("/create");
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setBusy(false);
    }
  }

  const canSubmit = Boolean(worldId && title.trim()) && !busy && ready;
  const chars = content.replace(/\s/g, "").length;

  if (!ready) {
    return <p className={styles.loading}>加载工作台…</p>;
  }

  return (
    <div className={styles.shell}>
      <header className={styles.bar}>
        <Link href={workId ? `/works/${workId}` : "/create"} className={styles.back}>
          ← {workId ? "作品" : "创作"}
        </Link>
        <span className={styles.typeTag}>{label}</span>
        <input
          className={styles.titleInput}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="无题"
          maxLength={200}
        />
        <span className={styles.state}>
          {busy
            ? "提交中…"
            : status === "pending"
              ? "待审核"
              : status === "published"
                ? "已发布"
                : ""}
        </span>
        <div className={styles.barActions}>
          <button
            type="button"
            className={styles.draft}
            disabled={!canSubmit}
            onClick={() => void submit(false)}
          >
            存草稿
          </button>
          <button
            type="button"
            className={styles.publish}
            disabled={!canSubmit}
            onClick={() => void submit(true)}
          >
            {isEdit && status === "published" ? "保存" : "发布"}
          </button>
        </div>
      </header>

      <div className={styles.body}>
        <main className={styles.editor}>
          <div className={styles.toolbar}>
            <span className={styles.toolLabel}>正文</span>
            <button
              type="button"
              className={styles.toolBtn}
              onClick={() => setPreview((p) => !p)}
            >
              {preview ? "继续编辑" : "预览"}
            </button>
            {category === "novel" ? (
              <label className={styles.upload}>
                上传文稿
                <input
                  type="file"
                  accept=".txt,.md,.markdown,text/plain,text/markdown"
                  hidden
                  onChange={(e) => {
                    void onUpload(e.target.files?.[0]);
                    e.target.value = "";
                  }}
                />
              </label>
            ) : null}
            <span className={styles.count}>{chars} 字</span>
          </div>

          {preview ? (
            <div className={styles.preview}>
              <MarkdownView
                content={content}
                worldSlug={activeSlug}
                entries={entries}
                collections={collections}
              />
            </div>
          ) : (
            <MarkdownEditor
              className={styles.surface}
              wrapClassName={styles.editorWrap}
              menuVariant="bottom"
              value={content}
              onChange={setContent}
              entries={entries}
              collections={collections}
              placeholder="从这里开始写……输入 [[ 选择词条引用。"
            />
          )}

          <div className={styles.foot}>
            {fileName ? <span>已导入：{fileName}</span> : null}
            {error ? <span className={styles.error}>{error}</span> : null}
          </div>
        </main>

        <aside className={styles.side}>
          <ImageUpload
            label="封面"
            value={mediaUrl}
            onChange={setMediaUrl}
            aspect="wide"
          />

          {workId ? (
            <div className={styles.field}>
              <span>归属世界</span>
              <div className={styles.readonly}>{worldName}</div>
            </div>
          ) : (
            <label className={styles.field}>
              <span>归属世界</span>
              <select
                value={worldId}
                onChange={(e) => setWorldId(e.target.value)}
              >
                <option value="">
                  {worlds.length === 0 ? "暂无可投稿的世界" : "选择世界观"}
                </option>
                {worlds.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </label>
          )}

          {kinds.length > 0 ? (
            <label className={styles.field}>
              <span>子类型</span>
              <select value={kind} onChange={(e) => setKind(e.target.value)}>
                <option value="">不限</option>
                {kinds.map((k) => (
                  <option key={k.key} value={k.key}>
                    {k.label}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className={styles.field}>
            <span>简介</span>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              placeholder="一句话介绍"
              maxLength={500}
              rows={4}
            />
          </label>

          <p className={styles.linkHint}>
            正文支持 Markdown；用 <code>[[词条名]]</code> 可直接链到该世界观
            Wiki 的词条。
          </p>

          {workId ? (
            confirmDelete ? (
              <span className={styles.confirmRow}>
                删除这篇作品？
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={() => void remove()}
                >
                  确定
                </button>
                <button
                  type="button"
                  className={styles.confirmBtn}
                  onClick={() => setConfirmDelete(false)}
                >
                  取消
                </button>
              </span>
            ) : (
              <button
                type="button"
                className={styles.danger}
                onClick={() => setConfirmDelete(true)}
              >
                删除作品
              </button>
            )
          ) : null}
        </aside>
      </div>
    </div>
  );
}
