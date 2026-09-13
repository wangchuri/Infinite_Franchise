"use client";

import MarkdownView from "@/components/MarkdownView";
import type { Block } from "@/lib/world-layout";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

/** Long-form text: binds to the intro entry (or the world description). */
export function Prose({ block }: { block: Block }) {
  const { world, entries } = useWorldBlocks();
  const source =
    typeof block.props?.source === "string" ? block.props.source : "intro";
  const title =
    typeof block.props?.title === "string" ? block.props.title : "世界介绍";
  const intro = entries.find(
    (e) => e.category === source || e.slug === source,
  );
  const content = intro?.content || world.description;

  return (
    <section id={block.id} className={styles.section}>
      {title ? (
        <div className={styles.sectionBar}>
          <h2>{title}</h2>
        </div>
      ) : null}
      <div className={styles.prose}>
        <MarkdownView content={content} />
      </div>
    </section>
  );
}
