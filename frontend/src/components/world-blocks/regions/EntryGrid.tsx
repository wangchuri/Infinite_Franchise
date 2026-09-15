"use client";

import type { Block, BlockVariant } from "@/lib/world-layout";
import { excerpt } from "@/lib/worlds";
import { useWorldBlocks } from "../WorldBlocksProvider";
import { VariantGrid } from "../content/VariantGrid";
import styles from "../blocks.module.css";

export function EntryGrid({ block }: { block: Block }) {
  const { world, byCategory } = useWorldBlocks();
  const category =
    typeof block.props?.category === "string" ? block.props.category : "";
  const title = typeof block.props?.title === "string" ? block.props.title : "";
  const withImage = block.props?.withImage === true;
  const isList = block.props?.style === "list";
  const variants = Array.isArray(block.props?.variants)
    ? (block.props.variants as BlockVariant[])
    : [];
  const list = byCategory[category] ?? [];
  if (list.length === 0) return null;

  const href = (slug: string) => `/w/${world.slug}/entry/${slug}`;

  return (
    <section id={block.id} className={styles.section}>
      {title ? (
        <div className={styles.sectionBar}>
          <h2>{title}</h2>
          <span className={styles.sectionCount}>{list.length}</span>
        </div>
      ) : null}
      {variants.length > 0 ? (
        <VariantGrid block={block} variants={variants} entries={list} />
      ) : isList ? (
        <dl className={styles.glossary}>
          {list.map((e) => (
            <div key={e.id} id={`entry-${e.slug}`} className={styles.glossaryRow}>
              <dt>
                <a href={href(e.slug)} className={styles.navSubLink}>
                  {e.title}
                </a>
              </dt>
              <dd>{excerpt(e.content, 120) || "暂无介绍"}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <div className={styles.entryGrid}>
          {list.map((e) => (
            <article
              key={e.id}
              id={`entry-${e.slug}`}
              className={styles.entryTile}
            >
              <a href={href(e.slug)} className={styles.entryTileLink}>
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
              </a>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
