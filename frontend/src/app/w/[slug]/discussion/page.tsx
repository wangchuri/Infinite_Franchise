"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import styles from "../world.module.css";

/** Placeholder — the world discussion board ships in a later step. */
export default function WorldDiscussionPage() {
  const params = useParams<{ slug: string }>();
  const slug = params.slug;

  return (
    <div className={styles.page}>
      <div className={styles.placeholder}>
        <h1>讨论区</h1>
        <p>这个世界观还没有开讨论区，敬请期待。</p>
        <Link href={`/w/${slug}`} className={styles.placeholderBack}>
          ← 返回世界观
        </Link>
      </div>
    </div>
  );
}
