"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import MarkdownView from "@/components/MarkdownView";
import CommentSection from "@/components/CommentSection";
import ReactionBar from "@/components/ReactionBar";
import {
  WORK_TYPE_LABEL,
  paginateContent,
  type WorkAnnotation,
  type WorkReadPayload,
} from "@/lib/works";
import styles from "./ReaderView.module.css";

export type ReadMode = "scroll" | "pages";

type Props = {
  data: WorkReadPayload;
};

const MODE_KEY = "if_read_mode";
const NOTES_KEY = "if_read_notes";

export default function ReaderView({ data }: Props) {
  const router = useRouter();
  const { work, novel, chapters, prevChapter, nextChapter, annotations } = data;

  const [mode, setMode] = useState<ReadMode>("scroll");
  const [showNotes, setShowNotes] = useState(true);
  const [page, setPage] = useState(0);
  const [activeNote, setActiveNote] = useState<WorkAnnotation | null>(null);

  useEffect(() => {
    const m = localStorage.getItem(MODE_KEY);
    if (m === "scroll" || m === "pages") setMode(m);
    const n = localStorage.getItem(NOTES_KEY);
    if (n === "0") setShowNotes(false);
    if (n === "1") setShowNotes(true);
  }, []);

  useEffect(() => {
    setPage(0);
    setActiveNote(null);
  }, [work.id]);

  const pages = useMemo(
    () => paginateContent(work.content ?? ""),
    [work.content],
  );

  useEffect(() => {
    if (mode !== "pages") return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight" || e.key === "PageDown") {
        e.preventDefault();
        setPage((p) => Math.min(pages.length - 1, p + 1));
      }
      if (e.key === "ArrowLeft" || e.key === "PageUp") {
        e.preventDefault();
        setPage((p) => Math.max(0, p - 1));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mode, pages.length]);

  function changeMode(next: ReadMode) {
    setMode(next);
    localStorage.setItem(MODE_KEY, next);
    setPage(0);
  }

  function toggleNotes() {
    setShowNotes((v) => {
      const next = !v;
      localStorage.setItem(NOTES_KEY, next ? "1" : "0");
      return next;
    });
  }

  const isNovelToc = work.type === "novel";
  const isChapter = work.type === "chapter";
  const isShort = work.type === "story";
  const hasTextBody =
    work.type === "story" ||
    work.type === "chapter" ||
    work.type === "other" ||
    (work.type === "novel" && Boolean(work.content));

  return (
    <div
      className={`${styles.shell} ${showNotes ? styles.withNotes : ""}`}
    >
      <div className={styles.main}>
        <header className={styles.toolbar}>
          <div className={styles.toolbarLeft}>
            <Link href="/" className={styles.back}>
              ← 广场
            </Link>
            <Link href={`/w/${work.worldSlug}`} className={styles.world}>
              {work.worldName}
            </Link>
          </div>
          <div className={styles.toolbarRight}>
            {hasTextBody && !isNovelToc ? (
              <div className={styles.modeSwitch} role="group" aria-label="阅读模式">
                <button
                  type="button"
                  className={mode === "scroll" ? styles.modeOn : styles.modeBtn}
                  onClick={() => changeMode("scroll")}
                >
                  滚动
                </button>
                <button
                  type="button"
                  className={mode === "pages" ? styles.modeOn : styles.modeBtn}
                  onClick={() => changeMode("pages")}
                >
                  翻页
                </button>
              </div>
            ) : null}
            <button
              type="button"
              className={showNotes ? styles.modeOn : styles.modeBtn}
              onClick={toggleNotes}
            >
              Wiki 注释{annotations.length ? ` · ${annotations.length}` : ""}
            </button>
          </div>
        </header>

        <article className={styles.reader}>
          <p className={styles.meta}>
            <span>{WORK_TYPE_LABEL[work.type] ?? work.type}</span>
            {novel && isChapter ? (
              <>
                <span aria-hidden="true"> · </span>
                <Link href={`/works/${novel.id}`}>{novel.title}</Link>
              </>
            ) : null}
          </p>

          {isShort || isChapter || (work.type !== "novel" && !isNovelToc) ? (
            <h1 className={styles.title}>{work.title}</h1>
          ) : (
            <h1 className={styles.title}>{work.title}</h1>
          )}

          <p className={styles.byline}>
            {work.authorDisplayName || work.authorUsername}
          </p>

          {work.summary && (isNovelToc || isShort) ? (
            <p className={styles.summary}>{work.summary}</p>
          ) : null}

          {work.mediaUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className={styles.media} src={work.mediaUrl} alt={work.title} />
          ) : null}

          {isNovelToc ? (
            <div className={styles.toc}>
              <h2>目录</h2>
              {chapters.length === 0 ? (
                <p className={styles.muted}>暂无已发布章节。</p>
              ) : (
                <ol className={styles.tocList}>
                  {chapters.map((ch, i) => (
                    <li key={ch.id}>
                      <Link href={`/works/${ch.id}`}>
                        <span className={styles.tocIndex}>{i + 1}</span>
                        {ch.title}
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          ) : null}

          {hasTextBody && !isNovelToc ? (
            mode === "scroll" ? (
              <div className={styles.body}>
                <MarkdownView
                  content={work.content ?? ""}
                  className={styles.readerMd}
                />
              </div>
            ) : (
              <div className={styles.pagePane}>
                <div className={styles.body}>
                  <MarkdownView
                    content={pages[page] ?? ""}
                    className={styles.readerMd}
                  />
                </div>
                <div className={styles.pageNav}>
                  <button
                    type="button"
                    className={styles.navBtn}
                    disabled={page <= 0}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    上一页
                  </button>
                  <span className={styles.pageIndicator}>
                    {page + 1} / {pages.length || 1}
                  </span>
                  <button
                    type="button"
                    className={styles.navBtn}
                    disabled={page >= pages.length - 1}
                    onClick={() =>
                      setPage((p) => Math.min(pages.length - 1, p + 1))
                    }
                  >
                    下一页
                  </button>
                </div>
              </div>
            )
          ) : null}

          {isChapter ? (
            <nav className={styles.chapterNav} aria-label="章节导航">
              {prevChapter ? (
                <button
                  type="button"
                  className={styles.chapterBtn}
                  onClick={() => router.push(`/works/${prevChapter.id}`)}
                >
                  ← {prevChapter.title}
                </button>
              ) : (
                <span className={styles.chapterPlaceholder} />
              )}
              {novel ? (
                <Link href={`/works/${novel.id}`} className={styles.tocLink}>
                  目录
                </Link>
              ) : null}
              {nextChapter ? (
                <button
                  type="button"
                  className={`${styles.chapterBtn} ${styles.chapterNext}`}
                  onClick={() => router.push(`/works/${nextChapter.id}`)}
                >
                  {nextChapter.title} →
                </button>
              ) : (
                <span className={styles.chapterPlaceholder} />
              )}
            </nav>
          ) : null}
        </article>
      </div>

      {showNotes ? (
        <aside className={styles.notes} aria-label="Wiki 注释">
          <p className={styles.notesTitle}>Wiki 注释</p>
          {annotations.length === 0 ? (
            <p className={styles.muted}>
              正文中暂未匹配到本世界词条。写作时关联词条后会出现在这里。
            </p>
          ) : (
            <ul className={styles.noteList}>
              {annotations.map((a) => (
                <li key={a.id}>
                  <button
                    type="button"
                    className={
                      activeNote?.id === a.id
                        ? styles.noteItemOn
                        : styles.noteItem
                    }
                    onClick={() =>
                      setActiveNote((cur) => (cur?.id === a.id ? null : a))
                    }
                  >
                    <strong>{a.title}</strong>
                    <span className={styles.noteSource}>
                      {a.source === "link" ? "关联" : "文中提及"}
                    </span>
                  </button>
                  {activeNote?.id === a.id ? (
                    <div className={styles.noteDetail}>
                      <p>{a.excerpt || "暂无简介"}</p>
                      <Link href={`/w/${work.worldSlug}`}>
                        在 Wiki 中查看 →
                      </Link>
                    </div>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
          <div className={styles.noteReactions}>
            <ReactionBar targetType="work" targetId={work.id} compact />
          </div>
          <div className={styles.noteComments}>
            <CommentSection targetType="work" targetId={work.id} />
          </div>
        </aside>
      ) : null}
    </div>
  );
}
