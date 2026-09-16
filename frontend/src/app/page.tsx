"use client";

import Link from "next/link";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { coverGradientFor } from "@/lib/world-cover";
import {
  fetchReactionTypes,
  type ReactionType,
} from "@/lib/reactions";
import {
  fetchFollowedWorlds,
  fetchPublicWorlds,
  type World,
} from "@/lib/worlds";
import {
  fetchPublicWorks,
  formatWorkTime,
  workTypeLabel,
  type Work,
} from "@/lib/works";
import WorkCover from "@/components/WorkCover";
import styles from "./page.module.css";

type ActiveAuthor = {
  id: string;
  name: string;
  username: string;
  worldName: string;
  worldSlug: string;
  lastTitle: string;
};

function worldDotColor(world: World): string {
  const g = coverGradientFor(world.id || world.slug);
  const m = g.match(/#[0-9a-fA-F]{6}/);
  return m?.[0] ?? "#1f5c5a";
}

type TopReaction = {
  key: string;
  icon: string;
  label: string;
  count: number;
};

/** Top-3 reactions by count (icon only on the plaza card). */
function topReactions(
  counts: Record<string, number>,
  types: ReactionType[],
): TopReaction[] {
  const byId = new Map(types.map((t) => [t.id, t]));
  return Object.entries(counts)
    .filter(([, n]) => n > 0)
    .map(([key, count]) => {
      const def = byId.get(key);
      return {
        key,
        icon: def?.icon ?? key,
        label: def?.label ?? key,
        count,
        sort: def?.sortOrder ?? 999,
      };
    })
    .sort((a, b) => b.count - a.count || a.sort - b.sort)
    .slice(0, 3);
}

export default function HomePage() {
  return (
    <Suspense fallback={<p className={styles.muted}>加载中…</p>}>
      <PlazaPage />
    </Suspense>
  );
}

function PlazaPage() {
  const searchParams = useSearchParams();
  const query = searchParams.get("q") ?? "";

  const [works, setWorks] = useState<Work[]>([]);
  const [followed, setFollowed] = useState<World[]>([]);
  const [recommended, setRecommended] = useState<World[]>([]);
  const [ready, setReady] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [loggedIn, setLoggedIn] = useState(false);
  const [reactionTypes, setReactionTypes] = useState<ReactionType[]>([]);

  useEffect(() => {
    let cancelled = false;
    const hasToken = Boolean(getAccessToken());

    async function load() {
      try {
        const workList = await fetchPublicWorks(40);
        if (cancelled) return;
        setWorks(workList);
        setFeedError(null);

        try {
          const types = await fetchReactionTypes();
          if (!cancelled) setReactionTypes(types);
        } catch {
          // reactions are decorative on the plaza; ignore failures
        }

        if (hasToken) {
          setLoggedIn(true);
          try {
            const mine = await fetchFollowedWorlds(24);
            if (!cancelled) setFollowed(mine);
          } catch {
            if (!cancelled) setFollowed([]);
          }
        } else {
          setLoggedIn(false);
          setFollowed([]);
        }

        const pubs = await fetchPublicWorlds(8);
        if (!cancelled) setRecommended(pubs);
      } catch (err) {
        if (!cancelled) {
          setWorks([]);
          setFeedError(err instanceof Error ? err.message : "作品流加载失败");
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

  const leftWorlds = followed.length > 0 ? followed : recommended.slice(0, 6);
  const leftIsRecommend = followed.length === 0;

  const filteredWorks = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return works;
    return works.filter((w) => {
      const hay = [
        w.title,
        w.summary ?? "",
        w.worldName,
        w.authorDisplayName,
        w.authorUsername,
        workTypeLabel(w),
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [works, query]);

  const authors = useMemo(() => {
    const map = new Map<string, ActiveAuthor>();
    for (const w of filteredWorks) {
      if (map.has(w.authorId)) continue;
      map.set(w.authorId, {
        id: w.authorId,
        name: w.authorDisplayName || w.authorUsername,
        username: w.authorUsername,
        worldName: w.worldName,
        worldSlug: w.worldSlug,
        lastTitle: w.title,
      });
      if (map.size >= 8) break;
    }
    return [...map.values()];
  }, [filteredWorks]);

  const showTip = ready && (Boolean(feedError) || works.length === 0);

  return (
    <div className={styles.plaza}>
      <aside className={styles.left} aria-label="关注的世界观">
        <div className={styles.rail}>
          <p className={styles.railTitle}>
            {leftIsRecommend ? "推荐世界观" : "关注的世界观"}
          </p>
          {!ready ? (
            <p className={styles.muted}>加载中…</p>
          ) : leftWorlds.length === 0 ? (
            <div className={styles.railEmpty}>
              <p>还没有可展示的世界。</p>
              <Link href="/discover">去发现世界 →</Link>
            </div>
          ) : (
            <>
              {leftIsRecommend && loggedIn ? (
                <p className={styles.railHint}>
                  尚未关注世界，先看看推荐。
                </p>
              ) : null}
              {!loggedIn ? (
                <p className={styles.railHint}>登录后可关注世界，出现在这里。</p>
              ) : null}
              {leftWorlds.map((w) => (
                <Link
                  key={w.id}
                  href={`/w/${w.slug}`}
                  className={styles.followItem}
                >
                  <span
                    className={styles.followDot}
                    style={{ background: worldDotColor(w) }}
                  />
                  <span>
                    <strong>{w.name}</strong>
                    <span className={styles.sub}>
                      {formatWorkTime(w.updatedAt)}
                    </span>
                  </span>
                </Link>
              ))}
              <Link href="/discover" className={styles.railMore}>
                发现更多 →
              </Link>
            </>
          )}
        </div>

        <div className={styles.railSecondary}>
          <p className={styles.railTitle}>活跃作者</p>
          {!ready ? (
            <p className={styles.muted}>加载中…</p>
          ) : authors.length === 0 ? (
            <p className={styles.railEmpty}>暂无活跃作者</p>
          ) : (
            authors.map((a) => (
              <div key={a.id} className={styles.authorItem}>
                <span className={styles.authorAvatar} aria-hidden>
                  {(a.name || "?").slice(0, 1)}
                </span>
                <span>
                  <strong>{a.name}</strong>
                  <span className={styles.sub}>
                    {a.worldName} · 更新了「{a.lastTitle}」
                  </span>
                </span>
              </div>
            ))
          )}
        </div>
      </aside>

      <section className={styles.feed} aria-label="最新作品">
        <p className={styles.feedLabel}>最新</p>
        {showTip ? (
          <p className={styles.lead}>
            广场是作品流——先看故事，再顺着标注进入所属世界观。找世界请去「发现世界」。
          </p>
        ) : null}

        {!ready ? (
          <ul className={styles.workGrid} aria-hidden="true">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <li key={i} className={styles.workCard}>
                <div className={styles.skelCover} />
                <div className={styles.feedLineWide} />
                <div className={styles.feedLine} />
              </li>
            ))}
          </ul>
        ) : feedError ? (
          <p className={styles.error}>{feedError}</p>
        ) : works.length === 0 ? (
          <div className={styles.empty}>
            <p>还没有公开作品。</p>
            <p className={styles.feedHint}>
              可以先去 <Link href="/discover">发现世界</Link>
              ，或点顶栏「创作」发布作品。
            </p>
          </div>
        ) : filteredWorks.length === 0 ? (
          <div className={styles.empty}>
            <p>没有匹配「{query.trim()}」的作品。</p>
          </div>
        ) : (
          <ul className={styles.workGrid}>
            {filteredWorks.map((w) => {
              const hot = topReactions(w.reactionCounts ?? {}, reactionTypes);
              return (
                <li key={w.id} className={styles.workCard}>
                  <Link
                    href={`/works/${w.id}`}
                    className={styles.cardHit}
                    aria-label={w.title}
                  />
                  <WorkCover work={w} />
                  <div className={styles.cardBody}>
                    <span className={styles.cardTitle}>{w.title}</span>
                    <div className={styles.cardMeta}>
                      <span className={styles.cardType}>
                        {workTypeLabel(w)}
                      </span>
                      <Link
                        href={`/w/${w.worldSlug}`}
                        className={styles.worldLink}
                      >
                        {w.worldName}
                      </Link>
                      <span>{w.authorDisplayName || w.authorUsername}</span>
                      <time dateTime={w.publishedAt ?? w.createdAt}>
                        {formatWorkTime(w.publishedAt ?? w.createdAt)}
                      </time>
                    </div>
                    {hot.length > 0 ? (
                      <div
                        className={styles.cardReactions}
                        aria-label="热门回应"
                      >
                        {hot.map((r) => (
                          <span
                            key={r.key}
                            className={styles.chip}
                            title={`${r.label} · ${r.count}`}
                          >
                            <span aria-hidden="true">{r.icon}</span>
                            <span className={styles.chipCount}>{r.count}</span>
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
