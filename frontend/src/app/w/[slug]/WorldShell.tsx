"use client";

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from "react";
import Link from "next/link";
import MarkdownView from "@/components/MarkdownView";
import { coverGradientFor, worldCoverImage } from "@/lib/world-cover";
import { fetchWorldBySlug, type World } from "@/lib/worlds";
import styles from "./world.module.css";

export type WorldTab = "works" | "topics";

type Props = {
  slug: string;
  activeTab: WorldTab;
  children: (ctx: { world: World; isOwner: boolean }) => ReactNode;
};

/**
 * Shared fixed-height sub-page chrome for a world: cover banner + pinned
 * intro/tab bar. Works and topics both render their content inside this shell,
 * so they read as one unified page; only detail pages are standalone.
 */
export default function WorldShell({ slug, activeTab, children }: Props) {
  const [world, setWorld] = useState<World | null>(null);
  const [isOwner, setIsOwner] = useState(false);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [headH, setHeadH] = useState(0);

  const headRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchWorldBySlug(slug);
        if (cancelled) return;
        setWorld(data.world);
        setIsOwner(data.isOwner);
        setCanEdit(data.canEdit);
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

  useEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const update = () => setHeadH(el.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [ready, slug]);

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

  const tags = world.tags
    .filter(Boolean)
    .filter((t, i, a) => a.indexOf(t) === i);
  const intro = world.welcomeMessage?.trim() || world.description;
  const wikiHref = `/w/${slug}/wiki`;

  const pageVars = { "--head-h": `${headH}px` } as CSSProperties;

  return (
    <div className={styles.page} style={pageVars}>
      <div className={styles.scroller}>
        <header className={styles.cover} style={coverStyle}>
          <div className={styles.coverInner}>
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
            <Link href={wikiHref} className={styles.wikiBtn}>
              进入 Wiki
            </Link>
          </div>
        </header>

        <div className={styles.headSticky} ref={headRef}>
          {intro ? (
            <section className={styles.intro}>
              <MarkdownView content={intro} />
            </section>
          ) : null}

          <nav className={styles.tabBar} aria-label="世界导航">
            <div className={styles.tabInner}>
              <Link
                href={`/w/${slug}`}
                className={activeTab === "works" ? styles.tabOn : styles.tab}
              >
                作品
              </Link>
              <Link
                href={`/w/${slug}?tab=topics`}
                className={activeTab === "topics" ? styles.tabOn : styles.tab}
              >
                话题
              </Link>
              <Link href={wikiHref} className={styles.wikiTab}>
                进入 Wiki
              </Link>
              {canEdit ? (
                <Link
                  href={`/worlds/${world.id}/wiki-hub`}
                  className={styles.wikiEdit}
                >
                  编辑 Wiki
                </Link>
              ) : null}
              {isOwner ? (
                <Link
                  href={`/worlds/${world.id}/edit`}
                  className={styles.editLink}
                >
                  编辑世界观
                </Link>
              ) : null}
            </div>
          </nav>
        </div>

        {children({ world, isOwner })}
      </div>
    </div>
  );
}
