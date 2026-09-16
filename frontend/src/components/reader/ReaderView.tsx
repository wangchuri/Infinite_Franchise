"use client";

import Link from "next/link";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { useRouter } from "next/navigation";
import MarkdownView from "@/components/MarkdownView";
import CommentSection from "@/components/CommentSection";
import ReactionBar from "@/components/ReactionBar";
import ReactionStampLayer from "./ReactionStampLayer";
import { getAccessToken } from "@/lib/auth";
import type { WorldCollection } from "@/lib/collections";
import {
  fetchWorkSticker,
  removeWorkSticker,
  setWorkSticker,
  type WorkStickerInfo,
} from "@/lib/stickers";
import {
  paginateContent,
  workTypeLabel,
  type Work,
  type WorkAnnotation,
  type WorkReadPayload,
} from "@/lib/works";
import type { WikiEntry, World } from "@/lib/worlds";
import styles from "./ReaderView.module.css";

export type ReadMode = "scroll" | "pages";

type Props = {
  data: WorkReadPayload;
  world?: World | null;
  entries?: WikiEntry[];
  collections?: WorldCollection[];
  others?: Work[];
};

type Size = "s" | "m" | "l" | "xl";
type Leading = "tight" | "normal" | "loose";
type Prefs = { size: Size; leading: Leading; night: boolean };

const MODE_KEY = "if_read_mode";
const NOTES_KEY = "if_read_notes";
const PREFS_KEY = "if_reader_prefs";
const SPOILER_KEY = "if_read_spoiler";

const SIZE_V: Record<Size, string> = {
  s: "0.98rem",
  m: "1.08rem",
  l: "1.2rem",
  xl: "1.34rem",
};
const LEADING_V: Record<Leading, string> = {
  tight: "1.62",
  normal: "1.85",
  loose: "2.15",
};
const SIZES: { key: Size; label: string }[] = [
  { key: "s", label: "小" },
  { key: "m", label: "中" },
  { key: "l", label: "大" },
  { key: "xl", label: "特大" },
];
const LEADINGS: { key: Leading; label: string }[] = [
  { key: "tight", label: "紧凑" },
  { key: "normal", label: "标准" },
  { key: "loose", label: "宽松" },
];
const DEFAULT_PREFS: Prefs = { size: "m", leading: "normal", night: false };

function formatDate(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
}

function textStats(content: string | null): { chars: number; minutes: number } {
  const chars = (content ?? "").replace(/\s+/g, "").length;
  return { chars, minutes: chars > 0 ? Math.max(1, Math.round(chars / 400)) : 0 };
}

export default function ReaderView({
  data,
  world = null,
  entries = [],
  collections = [],
  others = [],
}: Props) {
  const router = useRouter();
  const { work, novel, chapters, prevChapter, nextChapter, annotations } = data;

  const [mode, setMode] = useState<ReadMode>("scroll");
  const [showNotes, setShowNotes] = useState(true);
  const [spoilerFree, setSpoilerFree] = useState(true);
  const [wikiOpen, setWikiOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>(DEFAULT_PREFS);
  const [page, setPage] = useState(0);
  const [activeNote, setActiveNote] = useState<WorkAnnotation | null>(null);
  const [sticker, setSticker] = useState<WorkStickerInfo | null>(null);
  const [stickerBusy, setStickerBusy] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [lightbox, setLightbox] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);
  const settingsRef = useRef<HTMLDivElement>(null);
  const articleRef = useRef<HTMLElement>(null);
  const saveTimer = useRef<number | null>(null);

  useEffect(() => {
    const m = localStorage.getItem(MODE_KEY);
    if (m === "scroll" || m === "pages") setMode(m);
    const n = localStorage.getItem(NOTES_KEY);
    if (n === "0") setShowNotes(false);
    if (n === "1") setShowNotes(true);
    if (localStorage.getItem(SPOILER_KEY) === "0") setSpoilerFree(false);
    const raw = localStorage.getItem(PREFS_KEY);
    if (raw) {
      try {
        const p = JSON.parse(raw) as Partial<Prefs>;
        setPrefs({
          size: p.size && p.size in SIZE_V ? p.size : "m",
          leading: p.leading && p.leading in LEADING_V ? p.leading : "normal",
          night: Boolean(p.night),
        });
      } catch {
        /* keep defaults */
      }
    }
  }, []);

  useEffect(() => {
    setPage(0);
    setActiveNote(null);
    setLightbox(false);
    setSettingsOpen(false);
  }, [work.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (work.category !== "artwork") {
        if (!cancelled) setSticker(null);
        return;
      }
      try {
        const info = await fetchWorkSticker(work.id);
        if (!cancelled) setSticker(info);
      } catch {
        if (!cancelled) setSticker(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [work.id, work.category]);

  const pages = useMemo(
    () => paginateContent(work.content ?? ""),
    [work.content],
  );
  const stats = useMemo(() => textStats(work.content), [work.content]);

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

  const isChapter = work.type === "chapter";

  // Arrow keys flip chapters while reading in scroll mode.
  useEffect(() => {
    if (mode === "pages" || !isChapter) return;
    function onKey(e: KeyboardEvent) {
      const t = e.target as HTMLElement | null;
      if (t && /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)) return;
      if (e.key === "ArrowLeft" && prevChapter) {
        router.push(`/works/${prevChapter.id}`);
      } else if (e.key === "ArrowRight" && nextChapter) {
        router.push(`/works/${nextChapter.id}`);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [mode, isChapter, prevChapter, nextChapter, router]);

  useEffect(() => {
    if (!lightbox) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightbox(false);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [lightbox]);

  useEffect(() => {
    if (!settingsOpen) return;
    function onDown(e: MouseEvent) {
      if (!settingsRef.current?.contains(e.target as Node)) {
        setSettingsOpen(false);
      }
    }
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [settingsOpen]);

  const posKey = `if_read_pos:${work.id}`;

  // Track scroll progress and remember the position for this work.
  useEffect(() => {
    if (mode === "pages") return;
    let raf = window.requestAnimationFrame(() => {
      raf = 0;
      compute();
    });
    function compute() {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setScrollProgress(
        max > 0 ? Math.min(1, Math.max(0, window.scrollY / max)) : 1,
      );
    }
    function scheduleSave() {
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
      saveTimer.current = window.setTimeout(() => {
        try {
          localStorage.setItem(posKey, String(Math.round(window.scrollY)));
        } catch {
          /* ignore */
        }
      }, 350);
    }
    function onScroll() {
      if (raf) return;
      raf = window.requestAnimationFrame(() => {
        raf = 0;
        compute();
        scheduleSave();
      });
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) window.cancelAnimationFrame(raf);
      if (saveTimer.current) window.clearTimeout(saveTimer.current);
    };
  }, [mode, posKey]);

  // Resume where this work was last left off.
  useEffect(() => {
    if (mode !== "scroll") return;
    let y = 0;
    try {
      y = Number(localStorage.getItem(posKey) ?? "0");
    } catch {
      y = 0;
    }
    if (!y || Number.isNaN(y) || y < 80) return;
    const t = window.setTimeout(() => window.scrollTo({ top: y }), 140);
    return () => window.clearTimeout(t);
  }, [mode, posKey]);

  function updatePrefs(patch: Partial<Prefs>) {
    setPrefs((prev) => {
      const next = { ...prev, ...patch };
      localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      return next;
    });
  }

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

  function toggleSpoiler() {
    setSpoilerFree((v) => {
      const next = !v;
      localStorage.setItem(SPOILER_KEY, next ? "1" : "0");
      return next;
    });
  }

  async function onSetSticker() {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    setStickerBusy(true);
    try {
      const info = await setWorkSticker(work.id);
      setSticker({ sticker: info, canManage: true });
    } catch {
      /* ignore */
    } finally {
      setStickerBusy(false);
    }
  }

  async function onRemoveSticker() {
    setStickerBusy(true);
    try {
      await removeWorkSticker(work.id);
      setSticker((prev) => ({
        sticker: null,
        canManage: prev?.canManage ?? false,
      }));
    } catch {
      /* ignore */
    } finally {
      setStickerBusy(false);
    }
  }

  const isNovelToc = work.type === "novel";
  const hasTextBody =
    work.type === "story" ||
    work.type === "chapter" ||
    work.type === "other" ||
    (work.type === "novel" && Boolean(work.content));

  const readerVars = {
    "--reader-size": SIZE_V[prefs.size],
    "--reader-line": LEADING_V[prefs.leading],
  } as CSSProperties;

  const progress =
    mode === "pages"
      ? pages.length
        ? (page + 1) / pages.length
        : 0
      : scrollProgress;

  /** Finished the piece? Then spoilers (wiki + comments) may be revealed. */
  const finished =
    mode === "pages" ? page >= pages.length - 1 : scrollProgress >= 0.985;
  const gated = spoilerFree && !finished;

  return (
    <div
      className={`${styles.shell} ${showNotes ? styles.withNotes : ""} ${
        prefs.night ? styles.night : ""
      }`}
      style={readerVars}
    >
      <div className={styles.paperBg} aria-hidden="true" />
      <div className={styles.progressTrack} aria-hidden="true">
        <span
          className={styles.progressFill}
          style={{ transform: `scaleX(${progress})` }}
        />
      </div>
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
              <>
                <div className={styles.settingsWrap} ref={settingsRef}>
                  <button
                    type="button"
                    className={settingsOpen ? styles.modeOn : styles.modeBtn}
                    aria-expanded={settingsOpen}
                    aria-haspopup="dialog"
                    title="阅读设置"
                    onClick={() => setSettingsOpen((v) => !v)}
                  >
                    Aa
                  </button>
                  {settingsOpen ? (
                    <div
                      className={styles.settingsPanel}
                      role="dialog"
                      aria-label="阅读设置"
                    >
                      <div className={styles.settingsGroup}>
                        <span className={styles.settingsLabel}>字号</span>
                        <div className={styles.seg}>
                          {SIZES.map((s) => (
                            <button
                              key={s.key}
                              type="button"
                              className={
                                prefs.size === s.key
                                  ? styles.segOn
                                  : styles.segBtn
                              }
                              onClick={() => updatePrefs({ size: s.key })}
                            >
                              {s.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className={styles.settingsGroup}>
                        <span className={styles.settingsLabel}>行距</span>
                        <div className={styles.seg}>
                          {LEADINGS.map((l) => (
                            <button
                              key={l.key}
                              type="button"
                              className={
                                prefs.leading === l.key
                                  ? styles.segOn
                                  : styles.segBtn
                              }
                              onClick={() => updatePrefs({ leading: l.key })}
                            >
                              {l.label}
                            </button>
                          ))}
                        </div>
                      </div>
                      <label className={styles.settingSwitch}>
                        <span>夜间</span>
                        <input
                          type="checkbox"
                          checked={prefs.night}
                          onChange={(e) =>
                            updatePrefs({ night: e.target.checked })
                          }
                        />
                      </label>
                    </div>
                  ) : null}
                </div>
                <div
                  className={styles.modeSwitch}
                  role="group"
                  aria-label="阅读模式"
                >
                  <button
                    type="button"
                    className={
                      mode === "scroll" ? styles.modeOn : styles.modeBtn
                    }
                    onClick={() => changeMode("scroll")}
                  >
                    滚动
                  </button>
                  <button
                    type="button"
                    className={
                      mode === "pages" ? styles.modeOn : styles.modeBtn
                    }
                    onClick={() => changeMode("pages")}
                  >
                    翻页
                  </button>
                </div>
              </>
            ) : null}
            <button
              type="button"
              className={spoilerFree ? styles.modeOn : styles.modeBtn}
              onClick={toggleSpoiler}
              title="读完前隐藏相关 Wiki 与评论"
            >
              防剧透{spoilerFree ? " · 开" : " · 关"}
            </button>
            {data.canEdit ? (
              <Link href={`/works/${work.id}/edit`} className={styles.modeBtn}>
                编辑
              </Link>
            ) : null}
            <button
              type="button"
              className={showNotes ? styles.modeOn : styles.modeBtn}
              onClick={toggleNotes}
            >
              侧栏
            </button>
          </div>
        </header>

        <article className={styles.reader} ref={articleRef}>
          <p className={styles.meta}>
            <span>{workTypeLabel(work)}</span>
            {work.publishedAt ? (
              <>
                <span className={styles.dot} aria-hidden="true">
                  ·
                </span>
                <time dateTime={work.publishedAt}>
                  {formatDate(work.publishedAt)}
                </time>
              </>
            ) : null}
            {stats.chars > 0 ? (
              <>
                <span className={styles.dot} aria-hidden="true">
                  ·
                </span>
                <span>{stats.chars.toLocaleString()} 字</span>
                <span className={styles.dot} aria-hidden="true">
                  ·
                </span>
                <span>约 {stats.minutes} 分钟</span>
              </>
            ) : null}
            {data.canEdit && work.status !== "published" ? (
              <span className={styles.status}>
                {work.status === "pending" ? "待审核" : "草稿"}
              </span>
            ) : null}
          </p>

          <h1 className={styles.title}>{work.title}</h1>

          {work.mediaUrl ? (
            work.category === "video" ? (
              <figure className={styles.mediaWrap}>
                <video
                  className={styles.video}
                  src={work.mediaUrl}
                  controls
                  playsInline
                  preload="metadata"
                />
                <a
                  className={styles.mediaLink}
                  href={work.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  在新窗口打开 ↗
                </a>
              </figure>
            ) : work.category === "audio" ? (
              <figure className={styles.mediaWrap}>
                <audio
                  className={styles.audio}
                  src={work.mediaUrl}
                  controls
                  preload="metadata"
                />
                <a
                  className={styles.mediaLink}
                  href={work.mediaUrl}
                  target="_blank"
                  rel="noreferrer"
                >
                  在新窗口打开 ↗
                </a>
              </figure>
            ) : work.category === "artwork" ? (
              <button
                type="button"
                className={styles.artworkBtn}
                title="点击放大"
                onClick={() => setLightbox(true)}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className={styles.artwork}
                  src={work.mediaUrl}
                  alt={work.title}
                />
              </button>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                className={styles.media}
                src={work.mediaUrl}
                alt={work.title}
              />
            )
          ) : null}

          {work.category === "artwork" ? (
            <div className={styles.stickerBar}>
              {sticker?.sticker ? (
                <>
                  <span className={styles.stickerState}>
                    {sticker.sticker.artworkUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={sticker.sticker.artworkUrl}
                        alt=""
                        className={styles.stickerThumb}
                      />
                    ) : null}
                    已设为表情 · 被引用 {sticker.sticker.usageCount} 次
                  </span>
                  {sticker.canManage ? (
                    <button
                      type="button"
                      className={styles.stickerBtn}
                      disabled={stickerBusy}
                      onClick={() => void onRemoveSticker()}
                    >
                      取消表情
                    </button>
                  ) : null}
                </>
              ) : (
                <button
                  type="button"
                  className={styles.stickerBtn}
                  disabled={stickerBusy}
                  onClick={() => void onSetSticker()}
                >
                  {stickerBusy ? "处理中…" : "设为表情"}
                </button>
              )}
            </div>
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
                        <span className={styles.tocTitle}>{ch.title}</span>
                        {ch.publishedAt ? (
                          <time className={styles.tocDate}>
                            {formatDate(ch.publishedAt)}
                          </time>
                        ) : null}
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
                  worldSlug={work.worldSlug}
                  entries={entries}
                  collections={collections}
                />
              </div>
            ) : (
              <div className={styles.pagePane}>
                <div className={styles.body}>
                  <MarkdownView
                    content={pages[page] ?? ""}
                    className={styles.readerMd}
                    worldSlug={work.worldSlug}
                    entries={entries}
                    collections={collections}
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
                <Link
                  href={`/works/${prevChapter.id}`}
                  className={styles.chapterBtn}
                >
                  ← {prevChapter.title}
                </Link>
              ) : (
                <span className={styles.chapterPlaceholder} />
              )}
              {novel ? (
                <Link href={`/works/${novel.id}`} className={styles.tocLink}>
                  目录
                </Link>
              ) : null}
              {nextChapter ? (
                <Link
                  href={`/works/${nextChapter.id}`}
                  className={`${styles.chapterBtn} ${styles.chapterNext}`}
                >
                  {nextChapter.title} →
                </Link>
              ) : (
                <span className={styles.chapterPlaceholder} />
              )}
            </nav>
          ) : null}
        </article>

        <section className={styles.foot} aria-label="评论与反应">
          <div className={styles.footBar}>
            <ReactionBar targetType="work" targetId={work.id} />
          </div>
          {gated ? (
            <div className={styles.gateBlock}>
              <p className={styles.spoilerHint}>
                防剧透阅读中——读完本文后显示评论。
              </p>
              <button
                type="button"
                className={styles.spoilerBtn}
                onClick={() => setSpoilerFree(false)}
              >
                直接展开
              </button>
            </div>
          ) : (
            <div className={styles.footComments}>
              <CommentSection targetType="work" targetId={work.id} />
            </div>
          )}
        </section>

        {others.length > 0 ? (
          <section className={styles.more}>
            <h2 className={styles.moreTitle}>同世界的其他作品</h2>
            <ul className={styles.moreList}>
              {others.map((w) => (
                <li key={w.id}>
                  <Link href={`/works/${w.id}`} className={styles.moreCard}>
                    <span className={styles.moreThumb}>
                      {w.mediaUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={w.mediaUrl} alt="" />
                      ) : (
                        <span className={styles.moreGlyph}>
                          {workTypeLabel(w).slice(0, 1)}
                        </span>
                      )}
                    </span>
                    <span className={styles.moreBody}>
                      <strong>{w.title}</strong>
                      <span className={styles.moreMeta}>
                        {workTypeLabel(w)}
                        {w.authorDisplayName ? ` · ${w.authorDisplayName}` : ""}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
      </div>

      {showNotes ? (
        <aside className={styles.rail} aria-label="作品信息">
          <div className={styles.railScroll}>
          {work.summary ? (
            <section className={styles.railSection}>
              <h3 className={styles.railTitle}>简介</h3>
              <p className={styles.railSummary}>{work.summary}</p>
            </section>
          ) : null}

          <section className={styles.railSection}>
            <h3 className={styles.railTitle}>作者</h3>
            <div className={styles.authorCard}>
              <span className={styles.authorAvatar} aria-hidden="true">
                {work.authorAvatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={work.authorAvatarUrl} alt="" />
                ) : (
                  (work.authorDisplayName || work.authorUsername || "?").slice(
                    0,
                    1,
                  )
                )}
              </span>
              <Link
                href={`/u/${work.authorUsername}`}
                className={styles.authorText}
              >
                <strong>{work.authorDisplayName || work.authorUsername}</strong>
                <span className={styles.authorHandle}>
                  @{work.authorUsername}
                </span>
              </Link>
            </div>
            <p className={styles.authorBio}>
              {work.authorBio || "这位作者还没有填写介绍。"}
            </p>
          </section>

          {world ? (
            <section className={styles.railSection}>
              <h3 className={styles.railTitle}>世界观</h3>
              <Link href={`/w/${world.slug}`} className={styles.worldCard}>
                <span className={styles.worldLogo} aria-hidden="true">
                  {world.logoUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={world.logoUrl} alt="" />
                  ) : (
                    world.name.slice(0, 1)
                  )}
                </span>
                <span className={styles.worldText}>
                  <strong>{world.name}</strong>
                  <span className={styles.worldDesc}>
                    {world.tagline || world.description}
                  </span>
                </span>
              </Link>
            </section>
          ) : null}

          <section className={styles.railSection}>
            <button
              type="button"
              className={styles.railToggle}
              aria-expanded={wikiOpen}
              onClick={() => setWikiOpen((v) => !v)}
            >
              <span className={styles.railTitle}>Wiki</span>
              <span className={styles.railSign}>
                {wikiOpen ? "收起" : "展开"}
              </span>
            </button>

            {wikiOpen || gated ? (
              gated ? (
                <div className={styles.gateBlock}>
                  <p className={styles.spoilerHint}>
                    防剧透阅读中——读完本文后显示相关 Wiki。
                  </p>
                  <button
                    type="button"
                    className={styles.spoilerBtn}
                    onClick={() => setSpoilerFree(false)}
                  >
                    直接展开
                  </button>
                </div>
              ) : (
                <>
                  <p className={styles.railWorld}>
                    <Link href={`/w/${work.worldSlug}`}>{work.worldName}</Link>
                    <span className={styles.railSep} aria-hidden="true">
                      ·
                    </span>
                    <Link href={`/w/${work.worldSlug}/wiki`}>进入 Wiki</Link>
                  </p>
                  {annotations.length === 0 ? (
                    <p className={styles.muted}>
                      正文中暂未匹配到本世界词条。
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
                              setActiveNote((cur) =>
                                cur?.id === a.id ? null : a,
                              )
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
                              <Link
                                href={`/w/${work.worldSlug}/entry/${a.slug}`}
                              >
                                查看词条 →
                              </Link>
                            </div>
                          ) : null}
                        </li>
                      ))}
                    </ul>
                  )}
                </>
              )
            ) : null}
          </section>
          </div>
        </aside>
      ) : null}

      {lightbox && work.mediaUrl ? (
        <div
          className={styles.lightbox}
          role="dialog"
          aria-modal="true"
          onClick={() => setLightbox(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={work.mediaUrl} alt={work.title} />
          <span className={styles.lightboxHint}>点击任意处关闭 · Esc</span>
        </div>
      ) : null}

      <ReactionStampLayer
        targetType="work"
        targetId={work.id}
        hostRef={articleRef}
      />
    </div>
  );
}
