"use client";

import { useState, type FormEvent } from "react";
import type { TimelineEvent } from "@/lib/worlds";
import MarkdownView from "@/components/MarkdownView";
import styles from "./TimelineEditor.module.css";

type Props = {
  events: TimelineEvent[];
  onCreate: (input: {
    title: string;
    description: string;
    eventDate: string;
  }) => Promise<void>;
  onDelete: (eventId: string) => Promise<void>;
};

export default function TimelineEditor({ events, onCreate, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [eventDate, setEventDate] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!title.trim()) {
      setError("请填写事件名称");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        title: title.trim(),
        description,
        eventDate: eventDate.trim(),
      });
      setTitle("");
      setEventDate("");
      setDescription("");
      setOpen(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={`${styles.layout} ${open ? styles.withPanel : ""}`}>
      <div className={styles.main}>
        <div className={styles.toolbar}>
          <h3 className={styles.heading}>时间轴</h3>
          <button
            type="button"
            className={styles.addBtn}
            onClick={() => setOpen(true)}
          >
            {events.length === 0 ? "创建时间轴" : "添加事件"}
          </button>
        </div>

        {events.length === 0 ? (
          <p className={styles.empty}>
            尚未创建时间轴。点击右侧按钮添加第一个事件。
          </p>
        ) : (
          <ol className={styles.axis}>
            {events.map((ev) => (
              <li key={ev.id} className={styles.node}>
                <div className={styles.dot} />
                <div className={styles.card}>
                  {ev.eventDate ? (
                    <span className={styles.date}>{ev.eventDate}</span>
                  ) : null}
                  <strong className={styles.title}>{ev.title}</strong>
                  <MarkdownView content={ev.description} />
                  <button
                    type="button"
                    className={styles.remove}
                    onClick={() => void onDelete(ev.id)}
                  >
                    删除
                  </button>
                </div>
              </li>
            ))}
          </ol>
        )}
      </div>

      {open ? (
        <aside className={styles.panel}>
          <header className={styles.panelHeader}>
            <h4>添加事件</h4>
            <button type="button" onClick={() => setOpen(false)}>
              关闭
            </button>
          </header>
          <form className={styles.form} onSubmit={onSubmit}>
            {error ? <p className={styles.error}>{error}</p> : null}
            <label>
              <span>事件名称</span>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                maxLength={200}
              />
            </label>
            <label>
              <span>纪年 / 日期（可选）</span>
              <input
                value={eventDate}
                onChange={(e) => setEventDate(e.target.value)}
                placeholder="如：港务历 47"
                maxLength={64}
              />
            </label>
            <label>
              <span>详情（Markdown）</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={10}
                placeholder="用 Markdown 填写事件经过、影响等"
              />
            </label>
            <div className={styles.actions}>
              <button type="button" onClick={() => setOpen(false)}>
                取消
              </button>
              <button type="submit" className={styles.primary} disabled={busy}>
                {busy ? "添加中…" : "添加"}
              </button>
            </div>
          </form>
        </aside>
      ) : null}
    </div>
  );
}
