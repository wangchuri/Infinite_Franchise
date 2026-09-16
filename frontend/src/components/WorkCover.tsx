"use client";

import WorkTypeIcon from "./WorkTypeIcon";
import styles from "./WorkCover.module.css";

type CoverWork = {
  category: string;
  title: string;
  mediaUrl: string | null;
};

/**
 * Work cover: the artwork/video image when present, otherwise a type-styled
 * placeholder (serif title + the category glyph), matching the create tiles.
 */
export default function WorkCover({
  work,
  className,
  rounded = true,
}: {
  work: CoverWork;
  className?: string;
  rounded?: boolean;
}) {
  return (
    <span
      className={[styles.cover, rounded ? styles.rounded : "", className ?? ""]
        .filter(Boolean)
        .join(" ")}
    >
      {work.mediaUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={work.mediaUrl} alt="" className={styles.image} loading="lazy" />
      ) : (
        <span className={styles.placeholder}>
          <span className={styles.head}>
            <span className={styles.name}>{work.title}</span>
            <span className={styles.rule} />
          </span>
          <span className={styles.glyph}>
            <WorkTypeIcon category={work.category} />
          </span>
        </span>
      )}
    </span>
  );
}
