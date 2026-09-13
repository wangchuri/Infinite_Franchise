"use client";

import Link from "next/link";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

/** Author's own top bar (world name + owner edit entry). */
export function TopBar() {
  const { world, isOwner } = useWorldBlocks();
  return (
    <header className={styles.topbar}>
      <div className={styles.topbarInner}>
        <Link href={`/w/${world.slug}`} className={styles.topbarName}>
          {world.name}
        </Link>
        <div className={styles.topbarActions}>
          {isOwner ? (
            <Link
              href={`/worlds/${world.id}/edit`}
              className={styles.topbarBtn}
            >
              编辑
            </Link>
          ) : null}
        </div>
      </div>
    </header>
  );
}
