"use client";

import Link from "next/link";
import type { Block } from "@/lib/world-layout";
import { formatWorkTime, workTypeLabel } from "@/lib/works";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

export function WorkList({ block }: { block: Block }) {
  const { works } = useWorldBlocks();
  const title =
    typeof block.props?.title === "string" ? block.props.title : "作品";
  if (works.length === 0) return null;

  return (
    <section id={block.id} className={styles.section}>
      <div className={styles.sectionBar}>
        <h2>{title}</h2>
        <span className={styles.sectionCount}>{works.length}</span>
      </div>
      <ul className={styles.workList}>
        {works.map((w) => (
          <li key={w.id} className={styles.workItem}>
            <Link href={`/works/${w.id}`} className={styles.workTitle}>
              {w.title}
            </Link>
            <span className={styles.workType}>
              {workTypeLabel(w)}
            </span>
            {w.summary ? (
              <p className={styles.workSummary}>{w.summary}</p>
            ) : null}
            <span className={styles.workMeta}>
              {w.authorDisplayName || w.authorUsername} ·{" "}
              {formatWorkTime(w.publishedAt ?? w.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
