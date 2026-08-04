"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MarkdownView from "@/components/MarkdownView";
import ReactionBar from "@/components/ReactionBar";
import {
  MODULE_LABELS,
  normalizeHomepageConfig,
  themeCssVars,
  type WikiModule,
} from "@/lib/homepage-config";
import {
  excerpt,
  fetchWorldBySlug,
  type TimelineEvent,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import styles from "./wiki.module.css";

function formatUtc(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export default function WorldWikiPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchWorldBySlug(slug);
        if (cancelled) return;
        setWorld(data.world);
        setEntries(data.entries);
        setTimeline(data.timeline);
        setIsOwner(data.isOwner);
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

  const intro = useMemo(
    () => entries.find((e) => e.category === "intro"),
    [entries],
  );
  const characters = useMemo(
    () => entries.filter((e) => e.category === "character"),
    [entries],
  );
  const items = useMemo(
    () => entries.filter((e) => e.category === "item"),
    [entries],
  );

  const config = useMemo(
    () => normalizeHomepageConfig(world?.homepageConfig),
    [world?.homepageConfig],
  );

  if (!ready) {
    return <p className={styles.loading}>加载 Wiki…</p>;
  }

  if (!world) {
    return <p className={styles.error}>{error ?? "世界观不存在或尚未公开"}</p>;
  }

  const cssVars = themeCssVars(config) as CSSProperties;
  const pageClass = [
    styles.page,
    styles[`theme_${config.theme}`],
    styles[`layout_${config.layout}`],
  ].join(" ");

  const heroClass = [
    styles.hero,
    config.heroStyle === "compact" ? styles.heroCompact : "",
    config.heroStyle === "none" ? styles.heroNone : "",
  ]
    .filter(Boolean)
    .join(" ");

  const bg =
    config.heroStyle !== "none" && world.wikiBackgroundUrl
      ? {
          backgroundImage: `linear-gradient(180deg, rgba(20,33,43,0.5), rgba(20,33,43,0.72)), url(${world.wikiBackgroundUrl})`,
        }
      : undefined;

  function renderModule(mod: WikiModule) {
    switch (mod) {
      case "intro":
        return (
          <section key="intro" id="wiki-intro" className={styles.section}>
            <h2>{MODULE_LABELS.intro}</h2>
            <MarkdownView content={intro?.content || world!.description} />
            {intro ? (
              <div className={styles.reactionRow}>
                <ReactionBar targetType="entry" targetId={intro.id} compact />
              </div>
            ) : null}
          </section>
        );
      case "characters":
        if (characters.length === 0) return null;
        return (
          <section
            key="characters"
            id="wiki-characters"
            className={styles.section}
          >
            <h2>{MODULE_LABELS.characters}</h2>
            <div className={styles.grid}>
              {characters.map((c) => (
                <article key={c.id} className={styles.card}>
                  {c.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={c.imageUrl} alt="" className={styles.thumb} />
                  ) : (
                    <div className={styles.thumbEmpty} />
                  )}
                  <div className={styles.cardBody}>
                    <strong>{c.title}</strong>
                    <p>{excerpt(c.content, 90) || "暂无介绍"}</p>
                    <div className={styles.reactionRow}>
                      <ReactionBar targetType="entry" targetId={c.id} compact />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      case "items":
        if (items.length === 0) return null;
        return (
          <section key="items" id="wiki-items" className={styles.section}>
            <h2>{MODULE_LABELS.items}</h2>
            <div className={styles.grid}>
              {items.map((it) => (
                <article key={it.id} className={styles.card}>
                  {it.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.imageUrl} alt="" className={styles.thumb} />
                  ) : (
                    <div className={styles.thumbEmpty} />
                  )}
                  <div className={styles.cardBody}>
                    <strong>{it.title}</strong>
                    <p>{excerpt(it.content, 90) || "暂无介绍"}</p>
                    <div className={styles.reactionRow}>
                      <ReactionBar targetType="entry" targetId={it.id} compact />
                    </div>
                  </div>
                </article>
              ))}
            </div>
          </section>
        );
      case "timeline":
        if (timeline.length === 0) return null;
        return (
          <section key="timeline" id="wiki-timeline" className={styles.section}>
            <h2>{MODULE_LABELS.timeline}</h2>
            <ol className={styles.axis}>
              {timeline.map((ev) => (
                <li key={ev.id} className={styles.node}>
                  <div className={styles.dot} />
                  {ev.eventDate ? (
                    <span className={styles.date}>{ev.eventDate}</span>
                  ) : null}
                  <strong>{ev.title}</strong>
                  <MarkdownView content={ev.description} />
                  <div className={styles.reactionRow}>
                    <ReactionBar targetType="timeline" targetId={ev.id} compact />
                  </div>
                </li>
              ))}
            </ol>
          </section>
        );
      default:
        return null;
    }
  }

  const navItems = config.modules.filter((mod) => {
    if (mod === "intro") return true;
    if (mod === "characters") return characters.length > 0;
    if (mod === "items") return items.length > 0;
    if (mod === "timeline") return timeline.length > 0;
    return false;
  });

  return (
    <div className={pageClass} style={cssVars}>
      {config.heroStyle !== "none" ? (
        <header className={heroClass} style={bg}>
          <div className={styles.heroInner}>
            {world.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={world.logoUrl} alt="" className={styles.logo} />
            ) : (
              <div className={styles.logoEmpty} />
            )}
            <div className={styles.heroText}>
              <h1>{world.name}</h1>
              {config.showTags && world.tags.length > 0 ? (
                <div className={styles.tags}>
                  {world.tags.filter(Boolean).filter((t, i, arr) => arr.indexOf(t) === i).map((t, i) => (
                    <span key={`${t}-${i}`} className={styles.tag}>
                      #{t}
                    </span>
                  ))}
                </div>
              ) : null}
              {isOwner ? (
                <Link
                  href={`/worlds/${world.id}/edit`}
                  className={styles.editLink}
                >
                  编辑此世界观
                </Link>
              ) : null}
            </div>
          </div>
        </header>
      ) : (
        <div className={styles.titleOnly}>
          <h1>{world.name}</h1>
          {config.showTags && world.tags.length > 0 ? (
            <div className={styles.tags}>
              {world.tags.filter(Boolean).filter((t, i, arr) => arr.indexOf(t) === i).map((t, i) => (
                <span key={`${t}-${i}`} className={styles.tagMuted}>
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
          {isOwner ? (
            <Link href={`/worlds/${world.id}/edit`} className={styles.editLinkInk}>
              编辑此世界观
            </Link>
          ) : null}
        </div>
      )}

      <div className={styles.shell}>
        {config.layout === "sidebar" ? (
          <nav className={styles.sideNav} aria-label="Wiki 目录">
            <p className={styles.sideNavTitle}>目录</p>
            <ul>
              {navItems.map((mod) => (
                <li key={mod}>
                  <a href={`#wiki-${mod}`}>{MODULE_LABELS[mod]}</a>
                </li>
              ))}
            </ul>
          </nav>
        ) : null}

        <div className={styles.body}>
          {config.modules.map((mod) => renderModule(mod))}
          <p className={styles.meta}>
            {world.status === "draft" ? "草稿（仅创建者可见） · " : null}
            更新于 {formatUtc(world.updatedAt)}
          </p>
        </div>
      </div>
    </div>
  );
}
