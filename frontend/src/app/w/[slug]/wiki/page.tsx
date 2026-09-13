"use client";

import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import BlockRenderer from "@/components/world-blocks/BlockRenderer";
import WorldBlocksProvider from "@/components/world-blocks/WorldBlocksProvider";
import {
  normalizeHomepageConfig,
  themeCssVars,
} from "@/lib/homepage-config";
import { EMPTY_LAYOUT, normalizeWorldLayout } from "@/lib/world-layout";
import {
  fetchWorldBySlug,
  type TimelineEvent,
  type WikiEntry,
  type World,
} from "@/lib/worlds";
import { fetchWorldWorks, type Work } from "@/lib/works";
import styles from "./wiki.module.css";

export default function WorldWikiPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
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
        try {
          const list = await fetchWorldWorks(data.world.id, 30);
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

  const config = useMemo(
    () => normalizeHomepageConfig(world?.homepageConfig),
    [world?.homepageConfig],
  );

  /** Prefer an explicit block layout; otherwise adapt the legacy v1 config. */
  const layout = useMemo(() => {
    if (!world) return EMPTY_LAYOUT;
    if (world.layout.blocks.length > 0) return world.layout;
    return normalizeWorldLayout(world.homepageConfig);
  }, [world]);

  if (!ready) {
    return <p className={styles.loading}>加载 Wiki…</p>;
  }

  if (!world) {
    return <p className={styles.error}>{error ?? "世界观不存在或尚未公开"}</p>;
  }

  const cssVars = themeCssVars(config) as CSSProperties;

  return (
    <div className={styles.page} style={cssVars}>
      <WorldBlocksProvider
        world={world}
        entries={entries}
        timeline={timeline}
        works={works}
        isOwner={isOwner}
        config={config}
        layout={layout}
      >
        <BlockRenderer blocks={layout.blocks} />
      </WorldBlocksProvider>
    </div>
  );
}
