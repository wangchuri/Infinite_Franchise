"use client";

import { useState, type FormEvent } from "react";
import ImageUpload from "./ImageUpload";
import styles from "./EntrySlidePanel.module.css";

export type EntryFormValue = {
  title: string;
  content: string;
  imageUrl: string | null;
};

type Props = {
  kind: "character" | "item";
  initial?: EntryFormValue;
  onSave: (value: EntryFormValue) => Promise<void>;
  onClose: () => void;
};

export default function EntrySlidePanel({
  kind,
  initial,
  onSave,
  onClose,
}: Props) {
  const [title, setTitle] = useState(initial?.title ?? "");
  const [content, setContent] = useState(initial?.content ?? "");
  const [imageUrl, setImageUrl] = useState<string | null>(
    initial?.imageUrl ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const label = kind === "character" ? "人物" : "物品";

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("请填写名称");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        title: title.trim(),
        content,
        imageUrl,
      });
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <aside className={styles.panel} aria-label={`${label}设置`}>
      <header className={styles.header}>
        <h2>{initial ? `编辑${label}` : `添加${label}`}</h2>
        <button type="button" className={styles.close} onClick={onClose}>
          关闭
        </button>
      </header>
      <form className={styles.form} onSubmit={onSubmit}>
        {error ? <p className={styles.error}>{error}</p> : null}
        <ImageUpload
          label={kind === "character" ? "立绘图" : "物品图"}
          value={imageUrl}
          onChange={setImageUrl}
          aspect="portrait"
        />
        <label className={styles.field}>
          <span>名称</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={120}
            required
          />
        </label>
        <label className={styles.field}>
          <span>介绍（Markdown）</span>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={12}
            placeholder={"支持 Markdown，例如：\n\n## 背景\n……"}
          />
        </label>
        <div className={styles.actions}>
          <button type="button" className={styles.ghost} onClick={onClose}>
            取消
          </button>
          <button type="submit" className={styles.primary} disabled={busy}>
            {busy ? "保存中…" : "完成"}
          </button>
        </div>
      </form>
    </aside>
  );
}
