"use client";

import type { CSSProperties } from "react";
import type { Block } from "@/lib/world-layout";
import BlockRenderer from "../BlockRenderer";
import { cx } from "../shared";
import styles from "../blocks.module.css";

const SLOT_ORDER = ["left", "main", "right"];

function slotClass(key: string): string {
  if (key === "left") return styles.colLeft;
  if (key === "right") return styles.colRight;
  return styles.colMain;
}

/** "224:1fr:300" → "224px 1fr 300px"; already-CSS strings pass through. */
function ratioToTemplate(ratio: string | undefined): string | undefined {
  if (!ratio) return undefined;
  if (!ratio.includes(":")) return ratio;
  return ratio
    .split(":")
    .map((part) => {
      const t = part.trim();
      return /^\d+(\.\d+)?$/.test(t) ? `${t}px` : t;
    })
    .join(" ");
}

export function Columns({ block }: { block: Block }) {
  const slots = block.slots ?? {};
  const ratio =
    typeof block.props?.ratio === "string" ? block.props.ratio : undefined;
  const keys = [
    ...SLOT_ORDER.filter((k) => slots[k]),
    ...Object.keys(slots).filter((k) => !SLOT_ORDER.includes(k)),
  ];
  const template = ratioToTemplate(ratio);
  const style = template
    ? ({ "--cols": template } as CSSProperties)
    : undefined;

  return (
    <div id={block.id} className={styles.layout} style={style}>
      {keys.map((key) => (
        <div key={key} className={cx(styles.column, slotClass(key))}>
          <BlockRenderer blocks={slots[key]} />
        </div>
      ))}
    </div>
  );
}
