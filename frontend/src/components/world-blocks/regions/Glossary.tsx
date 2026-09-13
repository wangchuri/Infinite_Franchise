"use client";

import type { Block } from "@/lib/world-layout";
import { excerpt } from "@/lib/worlds";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

export function Glossary({ block }: { block: Block }) {
  const { byCategory } = useWorldBlocks();
  const category =
    typeof block.props?.category === "string" ? block.props.category : "concept";
  const title =
    typeof block.props?.title === "string" ? block.props.title : "概念";
  const list = byCategory[category] ?? [];
  if (list.length === 0) return null;

  return (
    <section id={block.id} className={styles.section}>
      <div className={styles.sectionBar}>
        <h2>{title}</h2>
        <span className={styles.sectionCount}>{list.length}</span>
      </div>
      <dl className={styles.glossary}>
        {list.map((e) => (
          <div key={e.id} id={`entry-${e.slug}`} className={styles.glossaryRow}>
            <dt>{e.title}</dt>
            <dd>{excerpt(e.content, 160) || "暂无说明"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
