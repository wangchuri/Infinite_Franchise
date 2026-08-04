"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";
import { fetchMe, getAccessToken, type AuthUser } from "@/lib/auth";
import {
  createComment,
  deleteComment,
  fetchComments,
  type WorkComment,
} from "@/lib/comments";
import type { ReactionTargetType } from "@/lib/reactions";
import styles from "./CommentSection.module.css";

type Props = {
  targetType: ReactionTargetType;
  targetId: string;
};

function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
}

export default function CommentSection({ targetType, targetId }: Props) {
  const router = useRouter();
  const [comments, setComments] = useState<WorkComment[]>([]);
  const [me, setMe] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const [list, user] = await Promise.all([
          fetchComments(targetType, targetId),
          getAccessToken() ? fetchMe().catch(() => null) : Promise.resolve(null),
        ]);
        if (!cancelled) {
          setComments(list);
          setMe(user);
        }
      } catch {
        if (!cancelled) setComments([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [targetType, targetId]);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    const content = draft.trim();
    if (!content || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const comment = await createComment(targetType, targetId, content);
      setComments((prev) => [...prev, comment]);
      setDraft("");
      if (!me) {
        const user = await fetchMe().catch(() => null);
        if (user) setMe(user);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "评论失败");
    } finally {
      setSubmitting(false);
    }
  }

  async function onDelete(id: string) {
    const ok = window.confirm("确定删除这条评论？");
    if (!ok) return;
    try {
      await deleteComment(id);
      setComments((prev) => prev.filter((c) => c.id !== id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className={styles.box}>
      <p className={styles.title}>评论 · {comments.length}</p>

      {loading ? (
        <p className={styles.muted}>加载评论…</p>
      ) : comments.length === 0 ? (
        <p className={styles.muted}>还没有评论，来抢沙发。</p>
      ) : (
        <ul className={styles.list}>
          {comments.map((c) => {
            const mine = me != null && me.id === c.userId;
            return (
              <li key={c.id} className={styles.item}>
                <div className={styles.head}>
                  <strong>{c.displayName || c.username}</strong>
                  <span className={styles.time}>{formatTime(c.createdAt)}</span>
                  {mine ? (
                    <button
                      type="button"
                      className={styles.del}
                      onClick={() => void onDelete(c.id)}
                    >
                      删除
                    </button>
                  ) : null}
                </div>
                <p className={styles.body}>{c.content}</p>
              </li>
            );
          })}
        </ul>
      )}

      {error ? <p className={styles.error}>{error}</p> : null}

      <form className={styles.form} onSubmit={onSubmit}>
        <textarea
          className={styles.input}
          rows={3}
          maxLength={2000}
          placeholder={
            getAccessToken() ? "写下你的看法…" : "登录后可评论"
          }
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <div className={styles.actions}>
          <span className={styles.hint}>{draft.length}/2000</span>
          <button
            type="submit"
            className={styles.submit}
            disabled={submitting || !draft.trim()}
          >
            {submitting ? "发布中…" : "发布"}
          </button>
        </div>
      </form>
    </div>
  );
}
