"use client";

import type { CSSProperties } from "react";
import type { Block } from "@/lib/world-layout";
import BlockRenderer from "../BlockRenderer";
import styles from "../blocks.module.css";

/** "320" → "320px"; already-CSS lengths pass through. */
function cssLength(value: string): string | undefined {
  const s = value.trim();
  if (!s) return undefined;
  return /^\d+(\.\d+)?$/.test(s) ? `${s}px` : s;
}

/** A full-width band with its own background image/gradient + content slot. */
export function BgRegion({ block }: { block: Block }) {
  const p = block.props ?? {};
  const rawImage = typeof p.image === "string" ? p.image : "";
  const image = rawImage.replace(/["\\\n\r]/g, "");
  const gradient = typeof p.gradient === "string" ? p.gradient : "";
  const color = typeof p.color === "string" ? p.color : "";
  const fixed = p.fixed === true;
  const padding = typeof p.padding === "string" ? p.padding : "";
  const minHeight =
    typeof p.minHeight === "string" ? cssLength(p.minHeight) : undefined;

  const overlayNum =
    typeof p.overlay === "number"
      ? p.overlay
      : typeof p.overlay === "string" && p.overlay.trim() !== ""
        ? Number(p.overlay)
        : 0;
  const overlay = Number.isFinite(overlayNum)
    ? Math.min(1, Math.max(0, overlayNum))
    : 0;

  const layers: string[] = [];
  if (overlay > 0) {
    layers.push(
      `linear-gradient(rgba(16,24,32,${overlay}), rgba(16,24,32,${overlay}))`,
    );
  }
  if (gradient) layers.push(gradient);
  if (image) layers.push(`url("${image}")`);

  const style: CSSProperties = {
    backgroundImage: layers.length ? layers.join(",") : undefined,
    backgroundColor: color || undefined,
    backgroundSize: image || gradient ? "cover" : undefined,
    backgroundPosition: "center",
    backgroundAttachment: fixed && image ? "fixed" : undefined,
    minHeight,
    padding: padding || undefined,
  };

  return (
    <section id={block.id} className={styles.bgRegion} style={style}>
      <div className={styles.bgRegionInner}>
        <BlockRenderer blocks={block.slots?.content ?? []} />
      </div>
    </section>
  );
}
