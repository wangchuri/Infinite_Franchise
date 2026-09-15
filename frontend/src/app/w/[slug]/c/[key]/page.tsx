"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { collectionName, type WorldCollection } from "@/lib/collections";
import {
  excerpt,
  fetchWorldBySlug,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import { decodeParam } from "@/lib/url";
import styles from "../../pageview.module.css";

export default function WorldCategoryPage() {
  const params = useParams<{ slug: string; key: string }>();
  const slug = decodeParam(params.slug);
  const key = decodeParam(params.key);

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [collections, setCollections] = useState<WorldCollection[]>([]);
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

  const list = useMemo(
    () => entries.filter((e) => e.category === key),
    [entries, key],
  );

  if (!ready) return <p className={styles.loading}>加载中…</p>;
  if (!world) return <p className={styles.error}>{error ?? "世界观不存在"}</p>;

  const collection = collections.find((c) => c.key === key);
  const name = collection?.name ?? collectionName(collections, key);

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
