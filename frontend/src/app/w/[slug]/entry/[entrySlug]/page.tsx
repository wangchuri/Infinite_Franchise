"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import MarkdownView from "@/components/MarkdownView";
import BlockRenderer from "@/components/world-blocks/BlockRenderer";
import WorldBlocksProvider from "@/components/world-blocks/WorldBlocksProvider";
import PrivateLock from "@/components/PrivateLock";
import { collectionName, type WorldCollection } from "@/lib/collections";
import { entryAttributeFields } from "@/lib/entry-schema";
import { normalizeHomepageConfig } from "@/lib/homepage-config";
import { decodeParam, findEntryBySlug } from "@/lib/url";
import {
  fetchWorldBySlug,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import styles from "../../pageview.module.css";

function isPreviewMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

export default function WorldEntryPage() {
  const params = useParams<{ slug: string; entrySlug: string }>();
  const slug = decodeParam(params.slug);
  const entrySlug = decodeParam(params.entrySlug);

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [collections, setCollections] = useState<WorldCollection[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchWorldBySlug(slug);
        if (cancelled) return;
        setWorld(data.world);
        setEntries(data.entries);
        setCollections(data.collections);
        setIsOwner(data.isOwner);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  const entry = useMemo(
    () => findEntryBySlug(entries, entrySlug),
    [entries, entrySlug],
  );

  const attrs = useMemo(() => {
    if (!entry) return [];
    return entryAttributeFields(entry.category, collections)
      .map((f) => ({ label: f.label, value: entry.attributes[f.key] ?? "" }))
      .filter((a) => a.value);
  }, [entry, collections]);

  if (!ready) return <p className={styles.loading}>加载中…</p>;
  if (!world) return <p className={styles.error}>{error ?? "世界观不存在"}</p>;
  if (!entry) return <p className={styles.error}>词条不存在。</p>;

  const categoryName = collectionName(collections, entry.category);
  const mode = entry.contentLayout.mode ?? "two";

  const relatedSlugs: string[] = [];
  for (const b of entry.contentLayout.blocks) {
    if (b.type !== "relatedEntries") continue;
    const raw = b.props?.slugs;
    if (Array.isArray(raw)) {
      for (const s of raw) if (typeof s === "string") relatedSlugs.push(s);
    }
  }
  const related = Array.from(new Set(relatedSlugs))
    .map((s) => entries.find((e) => e.slug === s))
    .filter((e): e is WikiEntry => e !== undefined);

  const article =
    entry.contentLayout.blocks.length > 0 ? (
      <div className={styles.article}>
        <WorldBlocksProvider
          world={world}
          entries={entries}
          collections={collections}
          timeline={[]}
          works={[]}
          isOwner={isOwner}
          config={normalizeHomepageConfig(world.homepageConfig)}
          layout={entry.contentLayout}
        >
          <BlockRenderer blocks={entry.contentLayout.blocks} />
        </WorldBlocksProvider>
      </div>
    ) : (
      <div className={styles.article}>
        <MarkdownView
          content={entry.content}
          worldSlug={world.slug}
          entries={entries}
          collections={collections}
        />
      </div>
    );

  const renderInfo = (showCover: boolean) => (
    <aside className={styles.attrCard}>
      {showCover && entry.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={entry.imageUrl} alt="" className={styles.infoCover} />
      ) : null}
      {entry.content.trim() ? (
        <div className={styles.infoIntro}>
          <MarkdownView
            content={entry.content}
            worldSlug={world.slug}
            entries={entries}
            collections={collections}
          />
        </div>
      ) : null}
      <h2>词条属性</h2>
      <dl>
        <div className={styles.attrRow}>
          <dt>归属</dt>
          <dd>{categoryName}</dd>
        </div>
        {attrs.map((a) => (
          <div key={a.label} className={styles.attrRow}>
            <dt>{a.label}</dt>
            <dd>{a.value}</dd>
          </div>
        ))}
      </dl>
      {related.length > 0 ? (
        <>
          <h2>相关词条</h2>
          <ul className={styles.relatedList}>
            {related.map((e) => (
              <li key={e.id}>
                <Link href={`/w/${world.slug}/entry/${e.slug}`}>{e.title}</Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      {isOwner && !isPreviewMode() ? (
        <Link href={`/worlds/${world.id}/entries`} className={styles.ownerLink}>
          编辑词条 →
        </Link>
      ) : null}
    </aside>
  );

  return (
    <div className={styles.page}>
      <nav className={styles.crumb}>
        <Link href={`/w/${world.slug}`}>
          {world.name}
          {world.visibility === "private" ? <PrivateLock /> : null}
        </Link>
        <span>/</span>
        <Link href={`/w/${world.slug}/c/${entry.category}`}>{categoryName}</Link>
        <span>/</span>
        <span>{entry.title}</span>
      </nav>

      {mode === "two" ? (
        <div className={styles.entryLayout}>
          <div className={styles.entryMain}>
            <h1>{entry.title}</h1>
            {article}
          </div>
          {renderInfo(true)}
        </div>
      ) : (
        <div className={styles.entrySingle}>
          <h1>{entry.title}</h1>
          {entry.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.imageUrl} alt="" className={styles.entryCover} />
          ) : null}
          {article}
          {renderInfo(false)}
        </div>
      )}
    </div>
  );
}
