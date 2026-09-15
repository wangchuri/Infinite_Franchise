"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import MarkdownView from "@/components/MarkdownView";
import CommentSection from "@/components/CommentSection";
import ReactionBar from "@/components/ReactionBar";
import {
  deleteTopic,
  fetchTopic,
  pinTopic,
  updateTopic,
  type Topic,
  type TopicDetail,
} from "@/lib/topics";
import { formatWorkTime } from "@/lib/works";
import { decodeParam } from "@/lib/url";
import styles from "../topics.module.css";

export default function TopicDetailPage() {
  const params = useParams<{ slug: string; id: string }>();
  const slug = decodeParam(params.slug);
  const id = params.id;
  const router = useRouter();

  const [detail, setDetail] = useState<TopicDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);

  const [editing, setEditing] = useState(false);
  const [titleDraft, setTitleDraft] = useState("");
  const [bodyDraft, setBodyDraft] = useState("");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchTopic(id);
        if (!cancelled) {
          setDetail(data);
          setTitleDraft(data.topic.title);
          setBodyDraft(data.topic.body);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  function applyTopic(topic: Topic) {
    setDetail((prev) => (prev ? { ...prev, topic } : prev));
  }

  async function onSaveEdit() {
    const t = titleDraft.trim();
    if (!t) return;
    setBusy(true);
    try {
      const topic = await updateTopic(id, { title: t, body: bodyDraft });
      applyTopic(topic);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    } finally {
      setBusy(false);
    }
  }

  async function onToggleStatus() {
    if (!detail) return;
    const next = detail.topic.status === "open" ? "resolved" : "open";
    setBusy(true);
    try {
      applyTopic(await updateTopic(id, { status: next }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function onTogglePin() {
    if (!detail) return;
    setBusy(true);
    try {
      applyTopic(await pinTopic(id, !detail.topic.pinned));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!window.confirm("确定删除这个话题吗？")) return;
    setBusy(true);
    try {
      await deleteTopic(id);
      router.push(`/w/${slug}?tab=topics`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
      setBusy(false);
    }
  }

  if (!ready) {
    return (
      <div className={styles.page}>
        <p className={styles.loading}>加载话题…</p>
      </div>
    );
  }

  if (error || !detail) {
    return (
      <div className={styles.page}>
        <div className={styles.inner}>
          <p className={styles.error}>{error ?? "话题不存在"}</p>
          <Link href={`/w/${slug}?tab=topics`} className={styles.back}>
            ← 返回话题列表
          </Link>
        </div>
      </div>
    );
  }

  const { topic, isAuthor, canModerate } = detail;
  const canStatus = isAuthor || canModerate;

  return (
    <div className={styles.page}>
      <div className={styles.inner}>
        <Link href={`/w/${slug}?tab=topics`} className={styles.back}>
          ← 话题列表
        </Link>

        <header className={styles.detailHead}>
          <div className={styles.detailTop}>
            {topic.pinned ? (
              <span className={`${styles.badge} ${styles.badgePinned}`}>置顶</span>
            ) : null}
            <span
              className={`${styles.badge} ${
                topic.status === "resolved"
                  ? styles.badgeResolved
                  : styles.badgeOpen
              }`}
            >
              {topic.status === "resolved" ? "已解决" : "讨论中"}
            </span>
          </div>

          {editing ? (
            <input
              className={styles.detailTitle}
              style={{ width: "100%", border: "1px solid var(--line)" }}
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              maxLength={160}
            />
          ) : (
            <h1 className={styles.detailTitle}>{topic.title}</h1>
          )}

          <div className={styles.detailMeta}>
            <span>{topic.authorDisplayName || topic.authorUsername}</span>
            <time dateTime={topic.createdAt}>
              {formatWorkTime(topic.createdAt)}
            </time>
            <span>{topic.commentCount} 条回复</span>
          </div>

          <div className={styles.actions}>
            {isAuthor ? (
              editing ? (
                <>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    disabled={busy}
                    onClick={() => void onSaveEdit()}
                  >
                    保存
                  </button>
                  <button
                    type="button"
                    className={styles.actionBtn}
                    onClick={() => {
                      setEditing(false);
                      setTitleDraft(topic.title);
                      setBodyDraft(topic.body);
                    }}
                  >
                    取消
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  className={styles.actionBtn}
                  onClick={() => setEditing(true)}
                >
                  编辑
                </button>
              )
            ) : null}

            {canStatus ? (
              <button
                type="button"
                className={styles.actionBtn}
                disabled={busy}
                onClick={() => void onToggleStatus()}
              >
                {topic.status === "open" ? "标为已解决" : "重新讨论"}
              </button>
            ) : null}

            {canModerate ? (
              <button
                type="button"
                className={styles.actionBtn}
                disabled={busy}
                onClick={() => void onTogglePin()}
              >
                {topic.pinned ? "取消置顶" : "置顶"}
              </button>
            ) : null}

            {isAuthor || canModerate ? (
              <button
                type="button"
                className={`${styles.actionBtn} ${styles.actionDanger}`}
                disabled={busy}
                onClick={() => void onDelete()}
              >
                删除
              </button>
            ) : null}
          </div>
        </header>

        <article className={styles.article}>
          {editing ? (
            <textarea
              rows={12}
              style={{
                width: "100%",
                padding: "0.6rem 0.75rem",
                border: "1px solid var(--line)",
                borderRadius: 6,
                font: "inherit",
              }}
              value={bodyDraft}
              onChange={(e) => setBodyDraft(e.target.value)}
            />
          ) : topic.body.trim() ? (
            <MarkdownView content={topic.body} />
          ) : (
            <p className={styles.articleEmpty}>（只有标题，没有正文）</p>
          )}
        </article>

        <div className={styles.reactions}>
          <ReactionBar targetType="topic" targetId={topic.id} />
        </div>

        <div className={styles.comments}>
          <CommentSection targetType="topic" targetId={topic.id} />
        </div>
      </div>
    </div>
  );
}
