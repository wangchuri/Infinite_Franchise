"use client";

import type { Block } from "@/lib/world-layout";
import { useWorldBlocks } from "../WorldBlocksProvider";
import { cx, unique } from "../shared";
import styles from "../blocks.module.css";

export function Hero({ block }: { block: Block }) {
  const { world, config } = useWorldBlocks();
  const compact = block.props?.compact === true;
  const showTags = block.props?.showTags !== false && config.showTags;
  const tags = unique(world.tags.filter(Boolean));
  const bg = world.wikiBackgroundUrl
    ? {
        backgroundImage: `linear-gradient(180deg, rgba(16,24,32,0.42), rgba(16,24,32,0.8)), url(${world.wikiBackgroundUrl})`,
      }
    : undefined;

  return (
    <header
      id={block.id}
      className={cx(styles.hero, compact && styles.heroCompact)}
      style={bg}
    >
      <div className={styles.heroInner}>
        {world.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={world.logoUrl} alt="" className={styles.logo} />
        ) : (
          <div className={styles.logoEmpty}>{world.name.slice(0, 1)}</div>
        )}
        <div className={styles.heroText}>
          <h1>{world.name}</h1>
          {world.tagline ? (
            <p className={styles.tagline}>{world.tagline}</p>
          ) : null}
          {showTags && tags.length > 0 ? (
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
    </header>
  );
}
