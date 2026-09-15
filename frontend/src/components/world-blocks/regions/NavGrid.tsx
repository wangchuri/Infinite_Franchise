"use client";

import type { CSSProperties } from "react";
import type { Block } from "@/lib/world-layout";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

/** Tile index of the world's collections (归属), linking to category pages. */
export function NavGrid({ block }: { block: Block }) {
  const { world, collections, byCategory } = useWorldBlocks();
  const title = typeof block.props?.title === "string" ? block.props.title : "";
  const columns =
    typeof block.props?.columns === "string" ? block.props.columns : "4";
  const withIcon = block.props?.withIcon !== false;
  const showCount = block.props?.showCount !== false;

  const tiles = collections
    .filter((c) => !c.hidden)
    .map((collection) => ({
      collection,
      count: (byCategory[collection.key] ?? []).length,
    }));

  if (tiles.length === 0) return null;

  return (
    <section id={block.id} className={styles.section}>
      {title ? (
        <div className={styles.sectionBar}>
          <h2>{title}</h2>
        </div>
      ) : null}
      <div
        className={styles.navGrid}
        style={{ "--nav-cols": columns } as CSSProperties}
      >
        {tiles.map(({ collection, count }) => (
          <a
            key={collection.id}
            className={styles.navTile}
            href={`/w/${world.slug}/c/${collection.key}`}
          >
            {withIcon ? (
              collection.iconUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={collection.iconUrl}
                  alt=""
                  className={styles.navTileIcon}
                />
              ) : (
                <span className={styles.navTileIconEmpty}>
                  {collection.name.slice(0, 1)}
                </span>
              )
            ) : null}
            <span className={styles.navTileLabel}>
              {collection.name}
              {showCount && count > 0 ? (
                <span className={styles.navTileCount}>{count}</span>
              ) : null}
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}
