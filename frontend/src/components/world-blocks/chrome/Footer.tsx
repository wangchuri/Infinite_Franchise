"use client";

import type { Block } from "@/lib/world-layout";
import { useWorldBlocks } from "../WorldBlocksProvider";
import { formatUtc } from "../shared";
import { PlatformButton } from "./PlatformButton";
import styles from "../blocks.module.css";

export function Footer({ block }: { block: Block }) {
  const { world } = useWorldBlocks();
  const showButton = block.props?.platformButton !== false;
  return (
    <footer className={styles.footer}>
      <div className={styles.footerInner}>
        <span className={styles.footerMeta}>
          {world.status === "draft" ? "草稿（仅创建者可见） · " : null}
          更新于 {formatUtc(world.updatedAt)}
        </span>
        {showButton ? (
          <div className={styles.footerActions}>
            <PlatformButton
              block={{
                id: `${block.id}-platform`,
                type: "platformButton",
                props: { label: "无限企划", target: "home" },
              }}
            />
          </div>
        ) : null}
      </div>
    </footer>
  );
}
