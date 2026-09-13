"use client";

import MarkdownView from "@/components/MarkdownView";
import type { Block } from "@/lib/world-layout";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

export function TimelineBlock({ block }: { block: Block }) {
  const { timeline } = useWorldBlocks();
  const title =
    typeof block.props?.title === "string" ? block.props.title : "时间轴";
  if (timeline.length === 0) return null;

  return (
    <section id={block.id} className={styles.section}>
      <div className={styles.sectionBar}>
        <h2>{title}</h2>
        <span className={styles.sectionCount}>{timeline.length}</span>
      </div>
      <ol className={styles.axis}>
        {timeline.map((ev) => (
          <li key={ev.id} className={styles.node}>
            <div className={styles.dot} />
            {ev.eventDate ? (
              <span className={styles.date}>{ev.eventDate}</span>
            ) : null}
            <strong className={styles.nodeTitle}>{ev.title}</strong>
            <MarkdownView content={ev.description} />
          </li>
        ))}
      </ol>
    </section>
  );
}
