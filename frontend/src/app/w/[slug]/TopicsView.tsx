"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import {
  createTopic,
  fetchTopics,
  type Topic,
  type TopicSort,
  type TopicStatus,
} from "@/lib/topics";
import { formatWorkTime } from "@/lib/works";
import styles from "./topics/topics.module.css";

type Filter = "all" | TopicStatus;

/** Topics board — rendered inside WorldShell so it shares the world chrome. */
export default function TopicsView({ slug }: { slug: string }) {
  const router = useRouter();

  const [topics, setTopics] = useState<Topic[]>([]);
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState<TopicSort>("latest");
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);

  const [formOpen, setFormOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!cancelled) setLoggedIn(Boolean(getAccessToken()));
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      setReady(false);
      try {
        const list = await fetchTopics(slug, {
          status: filter === "all" ? undefined : filter,
          sort,
        });
        if (!cancelled) {
          setTopics(list);
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
  }, [slug, filter, sort]);

  async function reload() {
    const list = await fetchTopics(slug, {
      status: filter === "all" ? undefined : filter,
      sort,
    });
    setTopics(list);
  }

  function openForm() {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    setFormOpen(true);
  }

  async function onSubmit() {
    const t = title.trim();
    if (!t) {
      setFormError("请填写标题");
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await createTopic(slug, { title: t, body });
      setTitle("");
      setBody("");
      setFormOpen(false);
      setFilter("all");
      setSort("latest");
      await reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "发布失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.board}>
      <div className={styles.boardHead}>
        <h2>话题</h2>
        <div className={styles.filters}>
          <button
            type="button"
            className={filter === "all" ? styles.filterOn : styles.filter}
            onClick={() => setFilter("all")}
          >
            全部
          </button>
          <button
            type="button"
            className={filter === "open" ? styles.filterOn : styles.filter}
            onClick={() => setFilter("open")}
          >
            讨论中
          </button>
          <button
            type="button"
            className={filter === "resolved" ? styles.filterOn : styles.filter}
            onClick={() => setFilter("resolved")}
          >
            已解决
          </button>
        </div>
        <button
          type="button"
          className={styles.sortToggle}
          onClick={() => setSort((s) => (s === "latest" ? "hot" : "latest"))}
        >
          {sort === "latest" ? "最新 ↓" : "最热 ↓"}
        </button>
        <button type="button" className={styles.newBtn} onClick={openForm}>
          + 新话题
        </button>
      </div>

      {formOpen ? (
        <div className={styles.form}>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="话题标题，如「假如……会怎样？」"
            maxLength={160}
            autoFocus
          />
          <textarea
            rows={5}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="展开说说你的想法（支持 Markdown）"
          />
          {formError ? <p className={styles.formError}>{formError}</p> : null}
          <div className={styles.formActions}>
            <button type="button" disabled={busy} onClick={() => void onSubmit()}>
              {busy ? "发布中…" : "发布话题"}
            </button>
            <button
              type="button"
              className={styles.formCancel}
              onClick={() => setFormOpen(false)}
            >
              取消
            </button>
          </div>
        </div>
      ) : null}

      {!ready ? (
        <p className={styles.empty}>加载话题…</p>
      ) : error ? (
        <p className={styles.error}>{error}</p>
      ) : topics.length === 0 ? (
        <p className={styles.empty}>
          还没有话题。{loggedIn ? "来发第一个吧。" : ""}
        </p>
      ) : (
        <ul className={styles.list}>
          {topics.map((t) => (
            <li key={t.id} className={styles.item}>
              <Link
                href={`/w/${slug}/topics/${t.id}`}
                className={styles.itemLink}
              >
                <div className={styles.itemTop}>
                  {t.pinned ? (
                    <span className={`${styles.badge} ${styles.badgePinned}`}>
                      置顶
                    </span>
                  ) : null}
                  <span className={styles.itemTitle}>{t.title}</span>
                  <span
                    className={`${styles.badge} ${
                      t.status === "resolved"
                        ? styles.badgeResolved
                        : styles.badgeOpen
                    }`}
                  >
                    {t.status === "resolved" ? "已解决" : "讨论中"}
                  </span>
                </div>
                <div className={styles.itemMeta}>
                  <span>{t.authorDisplayName || t.authorUsername}</span>
                  <time dateTime={t.createdAt}>
                    {formatWorkTime(t.createdAt)}
                  </time>
                  <span>{t.commentCount} 条回复</span>
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
