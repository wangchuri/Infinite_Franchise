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
import { PAGE_ROOT_ID, scopePageCss } from "@/lib/page-css";
import { decodeParam } from "@/lib/url";
import {
  fetchWorldBySlug,
  type TimelineEvent,
  type WikiEntry,
  type World,
  type WorldPage,
} from "@/lib/worlds";
import type { WorldCollection } from "@/lib/collections";
import { fetchWorldWorks, type Work } from "@/lib/works";
import {
  sampleCollections,
  sampleEntries,
  sampleTimeline,
  sampleWorks,
} from "@/lib/sample-world-data";
import styles from "./wiki.module.css";

/** `?preview=1` (layout editor) fills empty regions with example data. */
function isPreviewMode(): boolean {
  if (typeof window === "undefined") return false;
  return new URLSearchParams(window.location.search).get("preview") === "1";
}

export default function WorldWikiPage() {
  const params = useParams<{ slug: string }>();
  const slug = decodeParam(params.slug);

  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [collections, setCollections] = useState<WorldCollection[]>([]);
  const [timeline, setTimeline] = useState<TimelineEvent[]>([]);
  const [works, setWorks] = useState<Work[]>([]);
  const [pages, setPages] = useState<WorldPage[]>([]);
  const [isOwner, setIsOwner] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchWorldBySlug(slug);
        if (cancelled) return;
        const preview = isPreviewMode();
        setWorld(data.world);
        if (preview) {
          // Fill empty categories with samples so every region can be previewed.
          const present = new Set(data.entries.map((e) => e.category));
          const extra = sampleEntries(data.world.id).filter(
            (s) => !present.has(s.category),
          );
          setEntries([...data.entries, ...extra]);
          setCollections(
            data.collections.length === 0
              ? sampleCollections()
              : data.collections,
          );
          setTimeline(
            data.timeline.length === 0
              ? sampleTimeline(data.world.id)
              : data.timeline,
          );
        } else {
          setEntries(data.entries);
          setCollections(data.collections);
          setTimeline(data.timeline);
        }
        setIsOwner(data.isOwner);
        setPages(data.pages);
        try {
          const list = await fetchWorldWorks(data.world.id, 30);
          if (!cancelled) {
            setWorks(list.length === 0 && preview ? sampleWorks(data.world) : list);
          }
        } catch {
          if (!cancelled) {
            setWorks(preview ? sampleWorks(data.world) : []);
          }
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

  /** Prefer the home page's block layout, then the legacy world fields. */
  const layout = useMemo(() => {
    const home = pages.find((p) => p.kind === "home");
    if (home && home.layout.blocks.length > 0) return home.layout;
    if (!world) return EMPTY_LAYOUT;
    if (world.layout.blocks.length > 0) return world.layout;
    return normalizeWorldLayout(world.homepageConfig);
  }, [pages, world]);

  if (!ready) {
    return <p className={styles.loading}>加载 Wiki…</p>;
  }

  if (!world) {
    return <p className={styles.error}>{error ?? "世界观不存在或尚未公开"}</p>;
  }

  const cssVars = themeCssVars(config) as CSSProperties;

  const homeCss = pages.find((p) => p.kind === "home")?.css ?? "";
  const scopedCss = scopePageCss(homeCss);

  return (
    <div id={PAGE_ROOT_ID} className={styles.page} style={cssVars}>
      {scopedCss ? (
        <style dangerouslySetInnerHTML={{ __html: scopedCss }} />
      ) : null}
      <WorldBlocksProvider
        world={world}
        entries={entries}
        collections={collections}
        timeline={timeline}
        works={works}
        isOwner={isOwner}
        config={config}
        layout={layout}
        pageCss={homeCss}
      >
        <BlockRenderer blocks={layout.blocks} />
      </WorldBlocksProvider>
    </div>
  );
}
