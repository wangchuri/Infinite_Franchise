"use client";

import type { Block } from "@/lib/world-layout";
import { registry } from "./registry";

/** Renders a list of blocks through the whitelisted component registry. */
export default function BlockRenderer({ blocks }: { blocks: Block[] }) {
  return (
    <>
      {blocks.map((block) => {
        const Component = registry[block.type];
        if (!Component) return null;
        return <Component key={block.id} block={block} />;
      })}
    </>
  );
}
