"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import BlockRenderer from "@/components/world-blocks/BlockRenderer";
import WorldBlocksProvider from "@/components/world-blocks/WorldBlocksProvider";
import { normalizeHomepageConfig, themeCssVars } from "@/lib/homepage-config";
import { PAGE_ROOT_ID, scopePageCss } from "@/lib/page-css";
import { collectionName, type WorldCollection } from "@/lib/collections";
import {
  excerpt,
  fetchWorldBySlug,
  type TimelineEvent,
  type WikiEntry,
  type World,
  type WorldPage,
} from "@/lib/worlds";
import { sampleEntries, sampleTimeline } from "@/lib/sample-world-data";
import { decodeParam } from "@/lib/url";
import styles from "../../pageview.module.css";

export default function WorldCategoryPage() {
  const params = useParams<{ slug: string; key: string }>();
  const slug = decodeParam(params.slug);
  const key = decodeParam(params.key);

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [collections, setCollections] = useState<WorldCollection[]>([]);
  const [pages, setPages] = useState<WorldPage[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchWorldBySlug(slug);
        if (cancelled) return;
        const preview =
          typeof window !== "undefined" &&
          new URLSearchParams(window.location.search).get("preview") === "1";
        setWorld(data.world);
        setCollections(data.collections);
        setPages(data.pages);
        if (preview) {
          const has = data.entries.some((e) => e.category === key);
          const extra = has
            ? []
            : sampleEntries(data.world.id).filter((s) => s.category === key);
          setEntries([...data.entries, ...extra]);
          setTimeline(
            data.timeline.length === 0
              ? sampleTimeline(data.world.id)
              : data.timeline,
          );
        } else {
          setEntries(data.entries);
          setTimeline([]);
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
  }, [slug, key]);

  const list = useMemo(
    () => entries.filter((e) => e.category === key),
    [entries, key],
  );
  const page = useMemo(
    () => pages.find((p) => p.kind === "collection" && p.collectionKey === key),
    [pages, key],
  );

  if (!ready) return <p className={styles.loading}>加载中…</p>;
  if (!world) return <p className={styles.error}>{error ?? "世界观不存在"}</p>;

  const collection = collections.find((c) => c.key === key);
  const name = collection?.name ?? collectionName(collections, key);

  // Author-composed collection page (same blocks as the Wiki).
  if (page && page.layout.blocks.length > 0) {
    const config = normalizeHomepageConfig(world.homepageConfig);
    const cssVars = themeCssVars(config) as CSSProperties;
    const scoped = scopePageCss(page.css);
    return (
      <div id={PAGE_ROOT_ID} style={cssVars}>
        {scoped ? (
          <style dangerouslySetInnerHTML={{ __html: scoped }} />
        ) : null}
        <WorldBlocksProvider
          world={world}
          entries={entries}
          collections={collections}
          timeline={timeline}
          works={[]}
          isOwner={false}
          config={config}
          layout={page.layout}
          pageCss={page.css}
        >
          <BlockRenderer blocks={page.layout.blocks} />
        </WorldBlocksProvider>
      </div>
    );
  }

  return (
    <div className={styles.page}>
      <nav className={styles.crumb}>
        <Link href={`/w/${world.slug}`}>{world.name}</Link>
        <span>/</span>
        <Link href={`/w/${world.slug}/wiki`}>Wiki</Link>
        <span>/</span>
        <span>{name}</span>
      </nav>

      <header className={styles.header}>
        {collection?.iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={collection.iconUrl} alt="" className={styles.icon} />
        ) : (
          <span className={styles.iconEmpty}>{name.slice(0, 1)}</span>
        )}
        <div className={styles.headerText}>
          <h1>{name}</h1>
          <span>{list.length} 个词条</span>
        </div>
      </header>

      {list.length === 0 ? (
        <p className={styles.empty}>这个归属下还没有词条。</p>
      ) : (
        <div className={styles.grid}>
          {list.map((e) => (
            <Link
              key={e.id}
              href={`/w/${world.slug}/entry/${e.slug}`}
              className={styles.card}
            >
              {e.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.imageUrl} alt="" className={styles.thumb} />
              ) : (
                <div className={styles.thumbEmpty}>
                  <span>{e.title.slice(0, 1)}</span>
                </div>
              )}
              <strong className={styles.cardTitle}>{e.title}</strong>
              <p className={styles.cardExcerpt}>
                {excerpt(e.content, 72) || "暂无介绍"}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
