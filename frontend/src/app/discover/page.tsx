"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import WorldCard from "@/components/WorldCard";
import { fetchPublicWorlds, fetchTagPresets, type World } from "@/lib/worlds";
import styles from "./discover.module.css";

type SortKey = "updated" | "name";

export default function DiscoverPage() {
  return (
    <Suspense fallback={<p className={styles.lead}>加载中…</p>}>
      <DiscoverInner />
    </Suspense>
  );
}

function DiscoverInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [worlds, setWorlds] = useState<World[]>([]);
  const [presets, setPresets] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tag, setTag] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>("updated");

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const [list, tags] = await Promise.all([
          fetchPublicWorlds(100),
          fetchTagPresets(),
        ]);
        if (cancelled) return;
        setWorlds(list);
        setPresets(tags);
        setError(null);
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
  }, []);

  const availableTags = useMemo(() => {
    const fromWorlds = new Set<string>();
    for (const w of worlds) {
      for (const t of w.tags) {
        if (t) fromWorlds.add(t);
      }
    }
    const ordered = [
      ...presets.filter((t) => fromWorlds.has(t)),
      ...[...fromWorlds].filter((t) => !presets.includes(t)).sort(),
    ];
    return ordered;
  }, [worlds, presets]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = worlds.filter((w) => {
      if (tag && !w.tags.includes(tag)) return false;
      if (!q) return true;
      const hay = `${w.name} ${w.description} ${w.tags.join(" ")}`.toLowerCase();
      return hay.includes(q);
    });

    list = [...list].sort((a, b) => {
      if (sort === "name") {
        return a.name.localeCompare(b.name, "zh");
      }
      return (
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      );
    });
    return list;
  }, [worlds, query, tag, sort]);

  function clearQuery() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("q");
    const qs = params.toString();
    router.replace(`/discover${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  function clearFilters() {
    setTag(null);
    clearQuery();
  }

  return (
    <div className={styles.page}>
      <div className={styles.toolbar}>
        <div className={styles.sort}>
          <span className={styles.sortLabel}>排序</span>
          <button
            type="button"
            className={sort === "updated" ? styles.sortOn : styles.sortBtn}
            onClick={() => setSort("updated")}
          >
            最近更新
          </button>
          <button
            type="button"
            className={sort === "name" ? styles.sortOn : styles.sortBtn}
            onClick={() => setSort("name")}
          >
            名称
          </button>
        </div>
        <Link href="/worlds" className={styles.createCta}>
          ＋ 创建世界观
        </Link>
      </div>

      {availableTags.length > 0 ? (
        <div className={styles.filters} role="group" aria-label="按标签筛选">
          <button
            type="button"
            className={tag === null ? styles.chipOn : styles.chip}
            onClick={() => setTag(null)}
          >
            全部
          </button>
          {availableTags.map((t) => (
            <button
              key={t}
              type="button"
              className={tag === t ? styles.chipOn : styles.chip}
              onClick={() => setTag((cur) => (cur === t ? null : t))}
            >
              #{t}
            </button>
          ))}
        </div>
      ) : null}

      <div className={styles.resultBar}>
        {!ready ? (
          <span>正在载入…</span>
        ) : error ? (
          <span className={styles.error}>{error}</span>
        ) : (
          <span>
            {filtered.length === worlds.length
              ? `${worlds.length} 个公开世界`
              : `找到 ${filtered.length} / ${worlds.length} 个`}
            {tag ? ` · #${tag}` : null}
            {query.trim() ? ` · 「${query.trim()}」` : null}
          </span>
        )}
        {(tag || query.trim()) && ready ? (
          <button
            type="button"
            className={styles.clear}
            onClick={clearFilters}
          >
            清除筛选
          </button>
        ) : null}
      </div>

      {!ready ? (
        <div className={styles.skeletonGrid} aria-hidden="true">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className={styles.skeleton} />
          ))}
        </div>
      ) : error ? null : filtered.length === 0 ? (
        <div className={styles.empty}>
          {worlds.length === 0 ? (
            <>
              <h2>还没有公开世界</h2>
              <p>成为第一个发布者：创建世界观，写完设定后点发布。</p>
              <Link href="/worlds" className={styles.emptyCta}>
                去创建世界观
              </Link>
            </>
          ) : (
            <>
              <h2>没有匹配的世界</h2>
              <p>换个关键词，或清掉标签再试试。</p>
              <button
                type="button"
                className={styles.emptyCta}
                onClick={clearFilters}
              >
                查看全部
              </button>
            </>
          )}
        </div>
      ) : (
        <div className={styles.grid}>
          {filtered.map((w, i) => (
            <div
              key={w.id}
              className={styles.cardWrap}
              style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}
            >
              <WorldCard world={w} href={`/w/${w.slug}`} hideStatus />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
