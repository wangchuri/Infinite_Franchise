"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import {
  coverGradientFor,
  worldCoverImage,
} from "@/lib/world-cover";
import type { World } from "@/lib/worlds";
import styles from "./WorldCard.module.css";

type Props = {
  world: World;
  href: string;
  actions?: ReactNode;
  /** Hide draft/published badge (e.g. plaza only shows published). */
  hideStatus?: boolean;
};

/** Stable across SSR/CSR (avoid toLocaleString timezone mismatch). */
function formatTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())} UTC`;
}

export default function WorldCard({
  world,
  href,
  actions,
  hideStatus = false,
}: Props) {
  const image = worldCoverImage(world);
  const gradient = coverGradientFor(world.id || world.slug);
  const uniqueTags = [...new Set(world.tags.filter(Boolean))].slice(0, 4);

  return (
    <article className={styles.card}>
      <Link href={href} className={styles.hit}>
        <div
          className={styles.cover}
          style={
            image
              ? {
                  backgroundImage: `url(${image})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }
              : { background: gradient }
          }
        />
        <div className={styles.body}>
          <h3>{world.name || "未命名世界观"}</h3>
          <p className={styles.desc}>{world.description || "尚无简介"}</p>
          {uniqueTags.length > 0 ? (
            <div className={styles.tags}>
              {uniqueTags.map((t, i) => (
                <span key={`${t}-${i}`} className={styles.tag}>
                  #{t}
                </span>
              ))}
            </div>
          ) : null}
          <div className={styles.meta}>
            {hideStatus ? null : (
              <span>{world.status === "draft" ? "草稿" : "已发布"}</span>
            )}
            <span>更新于 {formatTime(world.updatedAt)}</span>
          </div>
        </div>
      </Link>
      {actions ? <div className={styles.actions}>{actions}</div> : null}
    </article>
  );
}
