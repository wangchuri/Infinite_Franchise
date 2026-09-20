"use client";

import Link from "next/link";
import type { Block } from "@/lib/world-layout";
import PrivateLock from "@/components/PrivateLock";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

/** Author's own top bar (world name + owner edit entry). */
export function TopBar({ block }: { block: Block }) {
  const { world, isOwner } = useWorldBlocks();
  return (
    <header id={block.id} className={styles.topbar}>
      <div className={styles.topbarInner}>
        <Link href={`/w/${world.slug}`} className={styles.topbarName}>
          {world.name}
          {world.visibility === "private" ? <PrivateLock /> : null}
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
