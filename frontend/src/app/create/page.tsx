"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken, fetchMe, type AuthUser } from "@/lib/auth";
import { searchUsers, type UserSearchItem } from "@/lib/users";
import ImageUpload from "@/components/world-editor/ImageUpload";
import styles from "./create.module.css";

type CreativeKind = {
  key: string;
  label: string;
  href: string;
  kinds: string[];
  /** Field labels — worlds use "world" wording. */
  titleLabel: string;
  coverLabel: string;
  authorLabel: string;
};

const KINDS: CreativeKind[] = [
  {
    key: "novel",
    label: "小说",
    href: "/create/novel",
    kinds: ["短篇", "长篇", "章节"],
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
  {
    key: "artwork",
    label: "美术",
    href: "/create/artwork",
    kinds: ["插画", "设定", "封面"],
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
  {
    key: "program",
    label: "程序",
    href: "/create/program",
    kinds: ["工具", "互动", "玩法"],
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
  {
    key: "audio",
    label: "音频",
    href: "/create/audio",
    kinds: ["音乐", "配音", "音效"],
    titleLabel: "作品名称",
    coverLabel: "作品封面",
    authorLabel: "作者",
  },
  {
    key: "world",
    label: "世界观",
    href: "/worlds",
    kinds: ["设定", "词条", "时间线"],
    titleLabel: "世界名称",
    coverLabel: "世界封面",
    authorLabel: "共创者",
  },
];

const KIND_BY_KEY = new Map(KINDS.map((k) => [k.key, k]));

/** Single gray tone per tile — the glyph is the only graphic. */
function KindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "novel":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <path
            d="M4 20.5 4.8 16.6 15.9 5.5a1.6 1.6 0 0 1 2.3 0l1.3 1.3a1.6 1.6 0 0 1 0 2.3L8.4 20.2 4 20.5z"
            fill="var(--tone)"
          />
          <path
            d="M4 20.5 4.8 16.6 8.4 20.2 4 20.5z"
            fill="var(--tone)"
            fillOpacity="0.45"
          />
          <path
            d="M13.7 7.7 16.3 10.3"
            stroke="rgba(243,239,230,0.9)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "artwork":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <path
            d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z"
            fill="var(--tone)"
          />
          <circle cx="7.6" cy="11.2" r="1.25" fill="var(--tone)" fillOpacity="0.5" />
          <circle cx="10.6" cy="7.4" r="1.25" fill="var(--tone)" fillOpacity="0.5" />
          <circle cx="15.2" cy="8" r="1.25" fill="rgba(243,239,230,0.9)" />
        </svg>
      );
    case "program":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <path
            d="M8.5 6.5 3.5 12l5 5.5"
            fill="none"
            stroke="var(--tone)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 6.5 20.5 12l-5 5.5"
            fill="none"
            stroke="var(--tone)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.2 5 10.8 19"
            fill="none"
            stroke="var(--tone)"
            strokeOpacity="0.45"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "audio":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <g
            stroke="var(--tone)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M5 10v4" />
            <path d="M9 7v10" />
            <path d="M13 5v14" />
            <path d="M17 8v8" />
          </g>
          <path
            d="M21 10v4"
            stroke="var(--tone)"
            strokeOpacity="0.45"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    case "world":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <circle
            cx="12"
            cy="12"
            r="8.5"
            fill="none"
            stroke="var(--tone)"
            strokeWidth="2.2"
          />
          <ellipse
            cx="12"
            cy="12"
            rx="3.8"
            ry="8.5"
            fill="none"
            stroke="var(--tone)"
            strokeOpacity="0.45"
            strokeWidth="2.2"
          />
          <path
            d="M3.5 12h17"
            stroke="var(--tone)"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    default:
      return null;
  }
}

export default function CreatePage() {
  const router = useRouter();
  const detailRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [kind, setKind] = useState<string | null>(null);

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
    router.push(current.href);
  }

  return (
    <div className={styles.page}>
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
              <KindIcon kind={k.key} />
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
              {current.kinds.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`${styles.chip} ${kind === s ? styles.chipOn : ""}`}
                  onClick={() => setKind((prev) => (prev === s ? null : s))}
                  aria-pressed={kind === s}
                >
                  {s}
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
    </div>
  );
}
