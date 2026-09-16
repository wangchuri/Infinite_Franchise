"use client";

import type { Block } from "@/lib/world-layout";
import { registry } from "./registry";
import styles from "./blocks.module.css";

/** Renders a list of blocks through the whitelisted component registry. */
export default function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => {
        const Component = registry[block.type];
        if (!Component) return null;
        const hideMobile = block.props?.hideOnMobile === true;
        return (
          <div
            key={block.id}
            className={styles.blockShell}
            data-hide-mobile={hideMobile ? "1" : undefined}
          >
            <Component block={block} />
          </div>
        );
      })}
    </>
  );
}
