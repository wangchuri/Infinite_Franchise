"use client";

import type { Block } from "@/lib/world-layout";
import { excerpt } from "@/lib/worlds";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

export function EntryGrid({ block }: { block: Block }) {
  const { byCategory } = useWorldBlocks();
  const category =
    typeof block.props?.category === "string" ? block.props.category : "";
  const title = typeof block.props?.title === "string" ? block.props.title : "";
  const withImage = block.props?.withImage === true;
  const list = byCategory[category] ?? [];
  if (list.length === 0) return null;

  return (
    <section id={block.id} className={styles.section}>
      {title ? (
        <div className={styles.sectionBar}>
          <h2>{title}</h2>
          <span className={styles.sectionCount}>{list.length}</span>
        </div>
      ) : null}
      <div className={styles.entryGrid}>
        {list.map((e) => (
          <article
            key={e.id}
            id={`entry-${e.slug}`}
            className={styles.entryTile}
          >
            {withImage ? (
              e.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={e.imageUrl} alt="" className={styles.thumb} />
              ) : (
                <div className={styles.thumbEmpty}>
                  <span>{e.title.slice(0, 1)}</span>
                </div>
              )
            ) : null}
            <strong className={styles.entryTitle}>{e.title}</strong>
            <p className={styles.entryExcerpt}>
              {excerpt(e.content, 72) || "暂无介绍"}
            </p>
          </article>
        ))}
      </div>
    </section>
  );
}
