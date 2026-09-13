"use client";

import Link from "next/link";
import type { Block } from "@/lib/world-layout";
import { cx } from "../shared";
import styles from "../blocks.module.css";

const PLATFORM_TARGETS: Record<string, string> = {
  home: "/",
  platform: "/",
  discover: "/discover",
};

function resolveHref(target: unknown): string {
  if (typeof target !== "string" || !target) return "/";
  if (PLATFORM_TARGETS[target]) return PLATFORM_TARGETS[target];
  if (target.startsWith("/")) return target;
  return "/";
}

/** Optional author-placed button back to the platform. */
export function PlatformButton({ block }: { block?: Block }) {
  const label =
    typeof block?.props?.label === "string" && block.props.label
      ? block.props.label
      : "无限企划";
  const solid = block?.props?.style === "solid";
  return (
    <Link
      href={resolveHref(block?.props?.target)}
      className={cx(styles.platformButton, solid && styles.platformButtonSolid)}
    >
      {label}
    </Link>
  );
}
