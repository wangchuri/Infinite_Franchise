"use client";

import { useMemo } from "react";
import type { Block } from "@/lib/world-layout";
import { useWorldBlocks } from "../WorldBlocksProvider";
import { SANDBOX, buildWorldData, safeJson } from "./world-data";
import styles from "../blocks.module.css";

/**
 * Author-authored HTML. Runs inside a sandboxed iframe (no same-origin), so it
 * can't touch the platform or the reader's session. World data is exposed as
 * `window.WORLD`:
 *   WORLD.world, WORLD.entries, WORLD.categories[category],
 *   WORLD.timeline, WORLD.works
 */
export function CustomHtml({ block }: { block: Block }) {
  const { world, entries, byCategory, timeline, works, pageCss } =
    useWorldBlocks();

  const html = typeof block.props?.html === "string" ? block.props.html : "";
  const css = typeof block.props?.css === "string" ? block.props.css : "";
  const heightRaw = block.props?.height;
  const height =
    typeof heightRaw === "number"
      ? heightRaw
      : typeof heightRaw === "string" && /^\d+$/.test(heightRaw.trim())
        ? Number(heightRaw.trim())
        : 360;

  const srcDoc = useMemo(() => {
    const data = buildWorldData({ world, entries, byCategory, timeline, works });
    return [
      '<!doctype html><html><head><meta charset="utf-8" />',
      "<style>html,body{margin:0;padding:0;",
      "font-family:system-ui,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;",
      "color:#14212b;}",
      css,
      "</style>",
      pageCss ? `<style>${pageCss}</style>` : "",
      "</head><body>",
      `<script>window.WORLD=${safeJson(data)};</script>`,
      html,
      "</body></html>",
    ].join("");
  }, [world, entries, byCategory, timeline, works, html, css, pageCss]);

  return (
    <section id={block.id} className={styles.section}>
      <iframe
        title="自定义内容"
        className={styles.customFrame}
        sandbox={SANDBOX}
        style={{ height }}
        srcDoc={srcDoc}
      />
    </section>
  );
}
