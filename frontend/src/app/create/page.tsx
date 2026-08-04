"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { fetchMyWorlds, type World } from "@/lib/worlds";
import { createWork, type WorkType } from "@/lib/works";
import styles from "./create.module.css";

export default function CreateWorkPage() {
  const router = useRouter();
  const [worlds, setWorlds] = useState<World[]>([]);
  const [worldId, setWorldId] = useState("");
  const [type, setType] = useState<WorkType>("story");
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [content, setContent] = useState("");
  const [mediaUrl, setMediaUrl] = useState("");
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    async function load() {
      try {
        const list = await fetchMyWorlds();
        if (cancelled) return;
        setWorlds(list);
        const published = list.find((w) => w.status === "published");
        setWorldId((published ?? list[0])?.id ?? "");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!worldId || !title.trim()) {
      setError("请选择世界观并填写标题");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const work = await createWork({
        worldId,
        type,
        title: title.trim(),
        summary: summary.trim() || undefined,
        content: content.trim() || undefined,
        mediaUrl: mediaUrl.trim() || null,
        publish: true,
      });
      router.push(`/works/${work.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "发布失败");
      setBusy(false);
    }
  }

  if (!ready) {
    return <p className={styles.muted}>加载中…</p>;
  }

  if (worlds.length === 0) {
    return (
      <div className={styles.page}>
        <h1 className={styles.title}>创作</h1>
        <p className={styles.lead}>
          作品必须归属某个世界观。你还没有世界观，先去创建一个。
        </p>
        <Link className={styles.primary} href="/worlds">
          创建世界观
        </Link>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Create</p>
        <h1 className={styles.title}>创作</h1>
        <p className={styles.lead}>
          发布作品到广场。有封面图可填图片地址；没有则使用默认渐变封面。
        </p>
      </header>

      <form className={styles.form} onSubmit={(e) => void onSubmit(e)}>
        <label className={styles.field}>
          <span>所属世界观</span>
          <select
            value={worldId}
            onChange={(e) => setWorldId(e.target.value)}
            required
          >
            {worlds.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
                {w.status === "draft" ? "（草稿·发布世界后才上广场）" : ""}
              </option>
            ))}
          </select>
        </label>

        <label className={styles.field}>
          <span>类型</span>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as WorkType)}
          >
            <option value="story">短篇</option>
            <option value="novel">长篇</option>
            <option value="chapter">章节</option>
            <option value="artwork">美术</option>
            <option value="audio">音频</option>
            <option value="video">视频</option>
            <option value="other">其他</option>
          </select>
        </label>

        <label className={styles.field}>
          <span>标题</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={200}
            required
            placeholder="作品名称"
          />
        </label>

        <label className={styles.field}>
          <span>摘要</span>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            maxLength={500}
            placeholder="列表里显示的一句话"
          />
        </label>

        <label className={styles.field}>
          <span>封面图 URL（可选）</span>
          <input
            value={mediaUrl}
            onChange={(e) => setMediaUrl(e.target.value)}
            placeholder="有图填地址；留空则用默认渐变"
          />
        </label>

        <label className={styles.field}>
          <span>正文（Markdown）</span>
          <textarea
            rows={10}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="故事正文…"
          />
        </label>

        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? "发布中…" : "发布到广场"}
          </button>
          <Link className={styles.ghost} href="/">
            取消
          </Link>
        </div>
      </form>
    </div>
  );
}
