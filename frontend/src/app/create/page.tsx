"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { getAccessToken, fetchMe, type AuthUser } from "@/lib/auth";
import { searchUsers, type UserSearchItem } from "@/lib/users";
import { WORK_KINDS, type WorkCategory } from "@/lib/work-taxonomy";
import { fetchMyWorks, formatWorkTime, workTypeLabel, type Work } from "@/lib/works";
import ImageUpload from "@/components/world-editor/ImageUpload";
import WorkTypeIcon from "@/components/WorkTypeIcon";
import WorkCover from "@/components/WorkCover";
import styles from "./create.module.css";

const STATUS_LABEL: Record<string, string> = {
  draft: "草稿",
  pending: "待审核",
  published: "已发布",
};

type CreativeKind = {
  key: WorkCategory;
  label: string;
  href: string;
  /** Field labels — works use "作品" wording. */
  titleLabel: string;
  coverLabel: string;
  authorLabel: string;
};

const KINDS: CreativeKind[] = [
  {
    key: "novel",
    label: "小说",
    href: "/create/novel",
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
  {
    key: "artwork",
    label: "美术",
    href: "/create/artwork",
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
  {
    key: "program",
    label: "程序",
    href: "/create/program",
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
  {
    key: "audio",
    label: "音频",
    href: "/create/audio",
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
  {
    key: "video",
    label: "视频",
    href: "/create/video",
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
];

const KIND_BY_KEY = new Map(KINDS.map((k) => [k.key, k]));

export default function CreatePage() {
  const router = useRouter();
  const detailRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<WorkCategory | null>(null);
  const [kind, setKind] = useState<string | null>(null);

  const [myWorks, setMyWorks] = useState<Work[]>([]);
  const [worksReady, setWorksReady] = useState(false);
  const [showTypes, setShowTypes] = useState(false);

  const [me, setMe] = useState<AuthUser | null>(null);
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [coAuthors, setCoAuthors] = useState<UserSearchItem[]>([]);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<UserSearchItem[]>([]);

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((u) => {
        if (!cancelled) setMe(u);
      })
      .catch(() => {});
    fetchMyWorks(60)
      .then((list) => {
        if (cancelled) return;
        setMyWorks(list);
        setShowTypes(list.length === 0);
        setWorksReady(true);
      })
      .catch(() => {
        if (!cancelled) setWorksReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  /** Scroll the kind section to the top once a type is picked. */
  useEffect(() => {
    if (selected && detailRef.current) {
      detailRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [selected]);

  useEffect(() => {
    const q = query.trim();
    if (!q) return;
    let cancelled = false;
    const t = window.setTimeout(async () => {
      try {
        const list = await searchUsers(q);
        if (!cancelled) setResults(list);
      } catch {
        if (!cancelled) setResults([]);
      }
    }, 280);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [query]);

  const current = selected ? KIND_BY_KEY.get(selected) ?? null : null;

  function reset() {
    setSelected(null);
    setKind(null);
    setTitle("");
    setSummary("");
    setCover(null);
    setCoAuthors([]);
    setQuery("");
    setResults([]);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function addAuthor(u: UserSearchItem) {
    if (u.id === me?.id) return;
    setCoAuthors((prev) => (prev.some((a) => a.id === u.id) ? prev : [...prev, u]));
    setQuery("");
    setResults([]);
  }

  function removeAuthor(id: string) {
    setCoAuthors((prev) => prev.filter((a) => a.id !== id));
  }

  function enterWorkbench(e: React.FormEvent) {
    e.preventDefault();
    if (!current || !title.trim()) return;
    const qs = new URLSearchParams();
    if (kind) qs.set("kind", kind);
    qs.set("title", title.trim());
    if (summary.trim()) qs.set("summary", summary.trim());
    if (cover) qs.set("cover", cover);
    router.push(`${current.href}?${qs.toString()}`);
  }

  const showWorks = worksReady && myWorks.length > 0 && !showTypes;

  return (
    <div className={styles.page}>
      {!worksReady ? (
        <p className={styles.panelHint}>加载…</p>
      ) : showWorks ? (
        <section className={styles.myWorks}>
          <div className={styles.myWorksHead}>
            <h2>我的作品</h2>
            <button
              type="button"
              className={styles.newWorkBtn}
              onClick={() => setShowTypes(true)}
            >
              ＋ 新建作品
            </button>
          </div>
          <ul className={styles.workGrid}>
            {myWorks.map((w) => (
              <li key={w.id}>
                <Link href={`/works/${w.id}`} className={styles.workCard}>
                  <WorkCover work={w} rounded={false} />
                  <span className={styles.workInfo}>
                    <span className={styles.workTop}>
                      <span className={styles.workKind}>
                        {workTypeLabel(w)}
                      </span>
                      <span
                        className={styles.workStatus}
                        data-status={w.status}
                      >
                        {STATUS_LABEL[w.status] ?? w.status}
                      </span>
                    </span>
                    <strong className={styles.workTitle}>{w.title}</strong>
                    <span className={styles.workMeta}>
                      {w.worldName} · {formatWorkTime(w.updatedAt)}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : (
        <>
          {myWorks.length > 0 ? (
            <button
              type="button"
              className={styles.backToWorks}
              onClick={() => setShowTypes(false)}
            >
              ← 我的作品
            </button>
          ) : null}
          <div className={styles.grid}>
        {KINDS.map((k) => (
          <button
            key={k.key}
            type="button"
            className={`${styles.tile} ${selected === k.key ? styles.tileOn : ""}`}
            data-kind={k.key}
            onClick={() => setSelected(k.key)}
            aria-pressed={selected === k.key}
          >
            <span className={styles.tileArt} aria-hidden="true">
              <WorkTypeIcon category={k.key} />
            </span>
            <span className={styles.tileText}>
              <span className={styles.tileLabel}>{k.label}</span>
            </span>
          </button>
        ))}
      </div>

      {!current ? (
        <p className={styles.tip}>选择你要创作的类型</p>
      ) : (
        <section className={styles.detail} ref={detailRef}>
          <button type="button" className={styles.backBtn} onClick={reset}>
            <span aria-hidden="true">←</span> 返回
          </button>

          <div className={styles.kindsHead}>
            <span className={styles.typeName}>{current.label}</span>
            <div className={styles.kinds}>
              {WORK_KINDS[current.key].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={`${styles.chip} ${kind === s.key ? styles.chipOn : ""}`}
                  onClick={() => setKind((prev) => (prev === s.key ? null : s.key))}
                  aria-pressed={kind === s.key}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {kind ? (
            <form className={styles.form} onSubmit={enterWorkbench}>
              <div className={styles.formRow}>
                <div className={styles.coverCol}>
                  <ImageUpload
                    label={current.coverLabel}
                    value={cover}
                    onChange={setCover}
                    aspect="portrait"
                  />
                </div>

                <div className={styles.infoCol}>
                  <label className={styles.field}>
                    <span>{current.titleLabel}</span>
                    <input
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={`给${current.label}起个名字`}
                      maxLength={200}
                      required
                    />
                  </label>

                  <div className={styles.authors}>
                    <span>{current.authorLabel}</span>
                    <div className={styles.authorList}>
                      {me ? (
                        <span className={styles.authorChip}>
                          {me.displayName || me.username}
                          <em>本人</em>
                        </span>
                      ) : null}
                      {coAuthors.map((a) => (
                        <span key={a.id} className={styles.authorChip}>
                          {a.displayName || a.username}
                          <em>待通过</em>
                          <button
                            type="button"
                            onClick={() => removeAuthor(a.id)}
                            aria-label={`移除 ${a.username}`}
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className={styles.authorSearch}>
                      <input
                        value={query}
                        onChange={(e) => {
                          const v = e.target.value;
                          setQuery(v);
                          if (!v.trim()) setResults([]);
                        }}
                        placeholder="按用户名检索本站用户"
                      />
                      {results.length > 0 ? (
                        <ul className={styles.results}>
                          {results
                            .filter(
                              (r) =>
                                r.id !== me?.id &&
                                !coAuthors.some((a) => a.id === r.id),
                            )
                            .map((r) => (
                              <li key={r.id}>
                                <button
                                  type="button"
                                  onClick={() => addAuthor(r)}
                                >
                                  {r.displayName || r.username}
                                  <span>@{r.username}</span>
                                </button>
                              </li>
                            ))}
                        </ul>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>

              <label className={styles.field}>
                <span>简介</span>
                <textarea
                  value={summary}
                  onChange={(e) => setSummary(e.target.value)}
                  placeholder="一句话介绍这个作品"
                  maxLength={500}
                />
              </label>

              <button
                type="submit"
                className={styles.enter}
                disabled={!title.trim()}
              >
                进入{current.label}创作工作台
              </button>
            </form>
          ) : (
            <p className={styles.panelHint}>
              选择一种{current.label}种类开始。
            </p>
          )}
        </section>
      )}
        </>
      )}
    </div>
  );
}
