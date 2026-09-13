"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MarkdownView from "@/components/MarkdownView";
import { coverGradientFor, worldCoverImage } from "@/lib/world-cover";
import { fetchWorldBySlug, type World } from "@/lib/worlds";
import {
  WORK_CATEGORIES,
  WORK_KINDS,
  categoryLabel,
  type WorkCategory,
} from "@/lib/work-taxonomy";
import {
  fetchWorldWorks,
  formatWorkTime,
  workTypeLabel,
  type Work,
} from "@/lib/works";
import styles from "./world.module.css";

function workThumbStyle(work: Work): CSSProperties {
  if (work.mediaUrl) {
    return {
      backgroundImage: `url(${work.mediaUrl})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { background: coverGradientFor(work.id) };
}

export default function WorldHomePage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [world, setWorld] = useState<World | null>(null);
  const [works, setWorks] = useState<Work[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [category, setCategory] = useState<"all" | WorkCategory>("all");
  const [kind, setKind] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchWorldBySlug(slug);
        if (cancelled) return;
        setWorld(data.world);
        setIsOwner(data.isOwner);
        try {
          const list = await fetchWorldWorks(data.world.id, 60);
          if (!cancelled) setWorks(list);
        } catch {
          if (!cancelled) setWorks([]);
        }
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
  }, [slug]);

  const catCounts = useMemo(() => {
    const m: Partial<Record<WorkCategory, number>> = {};
    for (const w of works) m[w.category] = (m[w.category] ?? 0) + 1;
    return m;
  }, [works]);

  const scoped = useMemo(
    () => (category === "all" ? works : works.filter((w) => w.category === category)),
    [works, category],
  );

  const kindCounts = useMemo(() => {
    const m: Record<string, number> = {};
    for (const w of scoped) {
      if (w.kind) m[w.kind] = (m[w.kind] ?? 0) + 1;
    }
    return m;
  }, [scoped]);

  const kinds = category === "all" ? [] : WORK_KINDS[category];

  const filtered = useMemo(
    () => (kind === "all" ? scoped : scoped.filter((w) => w.kind === kind)),
    [scoped, kind],
  );

  if (!ready) {
    return <p className={styles.loading}>加载世界观…</p>;
  }
  if (!world) {
    return <p className={styles.error}>{error ?? "世界观不存在或尚未公开"}</p>;
  }

  const cover = worldCoverImage(world);
  const coverStyle: CSSProperties = cover
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(16,24,32,0.32), rgba(16,24,32,0.82)), url(${cover})`,
      }
    : { background: coverGradientFor(world.id || world.slug) };

  const tags = world.tags.filter(Boolean).filter((t, i, a) => a.indexOf(t) === i);
  const intro = world.welcomeMessage?.trim() || world.description;

  function selectCategory(c: "all" | WorkCategory) {
    setCategory(c);
    setKind("all");
  }

  return (
    <div className={styles.page}>
      <header className={styles.cover} style={coverStyle}>
        <div className={styles.coverInner}>
          <Link href="/discover" className={styles.back}>
            ← 发现世界
          </Link>
          <div className={styles.coverText}>
            {world.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={world.logoUrl} alt="" className={styles.logo} />
            ) : (
              <div className={styles.logoEmpty}>{world.name.slice(0, 1)}</div>
            )}
            <div>
              <h1>{world.name}</h1>
              {world.tagline ? (
                <p className={styles.tagline}>{world.tagline}</p>
              ) : null}
              {tags.length > 0 ? (
                <div className={styles.tags}>
                  {tags.map((t, i) => (
                    <span key={`${t}-${i}`} className={styles.tag}>
                      #{t}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          </div>
        </div>
      </header>

      {intro ? (
        <section className={styles.intro}>
          <MarkdownView content={intro} />
        </section>
      ) : null}

      <nav className={styles.tabBar} aria-label="世界导航">
        <div className={styles.tabInner}>
          <span className={styles.tabOn}>作品</span>
          <Link href={`/w/${slug}/wiki`} className={styles.tab}>
            Wiki
          </Link>
          <Link href={`/w/${slug}/discussion`} className={styles.tab}>
            讨论
          </Link>
          {isOwner ? (
            <Link href={`/worlds/${world.id}/edit`} className={styles.editLink}>
              编辑世界观
            </Link>
          ) : null}
        </div>
      </nav>

      <div className={styles.layout}>
        <main className={styles.main}>
          <div className={styles.worksHead}>
            <h2>{category === "all" ? "全部作品" : categoryLabel(category)}</h2>
            <span className={styles.worksCount}>
              {filtered.length} / {works.length}
            </span>
          </div>

          {kinds.length > 0 ? (
            <div className={styles.kindTabs}>
              <button
                type="button"
                className={kind === "all" ? styles.kindOn : styles.kind}
                onClick={() => setKind("all")}
              >
                全部 <span>{scoped.length}</span>
              </button>
              {kinds.map((k) => (
                <button
                  key={k.key}
                  type="button"
                  className={kind === k.key ? styles.kindOn : styles.kind}
                  onClick={() => setKind(k.key)}
                >
                  {k.label} <span>{kindCounts[k.key] ?? 0}</span>
                </button>
              ))}
            </div>
          ) : null}

          {filtered.length === 0 ? (
            <div className={styles.empty}>
              <p>{works.length === 0 ? "这个世界还没有作品。" : "该类型下暂无作品。"}</p>
              <p className={styles.emptyHint}>
                进入 <Link href={`/w/${slug}/wiki`}>Wiki</Link> 了解设定，
                或到 <Link href="/create">创作</Link> 投稿。
              </p>
            </div>
          ) : (
            <ul className={styles.list}>
              {filtered.map((w) => (
                <li key={w.id} className={styles.item}>
                  <Link
                    href={`/works/${w.id}`}
                    className={styles.hit}
                    aria-label={w.title}
                  />
                  <div
                    className={styles.thumb}
                    style={workThumbStyle(w)}
                    aria-hidden="true"
                  />
                  <div className={styles.itemBody}>
                    <div className={styles.typeTag}>{workTypeLabel(w)}</div>
                    <span className={styles.workTitle}>{w.title}</span>
                    {w.summary ? (
                      <p className={styles.workSummary}>{w.summary}</p>
                    ) : null}
                    <div className={styles.workMeta}>
                      <span>{w.authorDisplayName || w.authorUsername}</span>
                      <time dateTime={w.publishedAt ?? w.createdAt}>
                        {formatWorkTime(w.publishedAt ?? w.createdAt)}
                      </time>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </main>

        <aside className={styles.rail}>
          <p className={styles.railTitle}>类型</p>
          <ul className={styles.railList}>
            <li>
              <button
                type="button"
                className={category === "all" ? styles.railOn : styles.railBtn}
                onClick={() => selectCategory("all")}
              >
                全部 <span>{works.length}</span>
              </button>
            </li>
            {WORK_CATEGORIES.map((c) => {
              const n = catCounts[c.key] ?? 0;
              return (
                <li key={c.key}>
                  <button
                    type="button"
                    disabled={n === 0}
                    className={category === c.key ? styles.railOn : styles.railBtn}
                    onClick={() => selectCategory(c.key)}
                  >
                    {c.label} <span>{n}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        </aside>
      </div>
    </div>
  );
}
