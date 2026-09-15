"use client";

import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
} from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { coverGradientFor } from "@/lib/world-cover";
import { decodeParam } from "@/lib/url";
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
import WorldShell from "./WorldShell";
import TopicsView from "./TopicsView";
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

function WorksView({ worldId, slug }: { worldId: string; slug: string }) {
  const [works, setWorks] = useState<Work[]>([]);
  const [category, setCategory] = useState<"all" | WorkCategory>("all");
  const [kind, setKind] = useState<string>("all");

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchWorldWorks(worldId, 60);
        if (!cancelled) setWorks(list);
      } catch {
        if (!cancelled) setWorks([]);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  const catCounts = useMemo(() => {
    const m: Partial<Record<WorkCategory, number>> = {};
    for (const w of works) m[w.category] = (m[w.category] ?? 0) + 1;
    return m;
  }, [works]);

  const scoped = useMemo(
    () =>
      category === "all" ? works : works.filter((w) => w.category === category),
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

  function selectCategory(c: "all" | WorkCategory) {
    setCategory(c);
    setKind("all");
  }

  const wikiHref = `/w/${slug}/wiki`;

  return (
    <div className={styles.layout}>
      <main className={styles.main}>
        <div className={styles.worksHead}>
          <h2>{category === "all" ? "全部作品" : categoryLabel(category)}</h2>
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
          <span className={styles.worksCount}>
            {filtered.length} / {works.length}
          </span>
        </div>

        {filtered.length === 0 ? (
          <div className={styles.empty}>
            <p>
              {works.length === 0
                ? "这个世界还没有作品。"
                : "该类型下暂无作品。"}
            </p>
            <p className={styles.emptyHint}>
              进入 <Link href={wikiHref}>Wiki</Link> 了解设定，或到{" "}
              <Link href="/create">创作</Link> 投稿。
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
                  className={
                    category === c.key ? styles.railOn : styles.railBtn
                  }
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
  );
}

function WorldPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeParam(params.slug);
  const searchParams = useSearchParams();
  const tab = searchParams.get("tab") === "topics" ? "topics" : "works";

  return (
    <WorldShell slug={slug} activeTab={tab}>
      {({ world }) =>
        tab === "topics" ? (
          <TopicsView slug={slug} />
        ) : (
          <WorksView worldId={world.id} slug={slug} />
        )
      }
    </WorldShell>
  );
}

export default function WorldHomePage() {
  return (
    <Suspense fallback={<p className={styles.loading}>加载世界观…</p>}>
      <WorldPage />
    </Suspense>
  );
}
