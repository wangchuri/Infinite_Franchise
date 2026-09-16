"use client";

import Link from "next/link";
import styles from "./WikiTiles.module.css";

function EntryIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      className={styles.icon}
      aria-hidden="true"
    >
      <path
        d="M6 3.5h8.2L19 8.3V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"
        fill="var(--tone)"
      />
      <path
        d="M14 3.5V8.3H19"
        fill="none"
        stroke="rgba(243,239,230,0.9)"
        strokeWidth="1.4"
      />
      <g
        stroke="rgba(243,239,230,0.9)"
        strokeWidth="1.5"
        strokeLinecap="round"
      >
        <path d="M8 12h8" />
        <path d="M8 15h8" />
        <path d="M8 18h5" />
      </g>
    </svg>
  );
}

function PageIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      preserveAspectRatio="xMidYMid meet"
      className={styles.icon}
      aria-hidden="true"
    >
      <rect x="3" y="4.5" width="18" height="15" rx="1.6" fill="var(--tone)" />
      <rect
        x="5.4"
        y="7"
        width="6"
        height="10"
        rx="1"
        fill="rgba(243,239,230,0.9)"
      />
      <rect
        x="13.2"
        y="7"
        width="5.4"
        height="4.4"
        rx="1"
        fill="rgba(243,239,230,0.9)"
      />
      <rect
        x="13.2"
        y="12.8"
        width="5.4"
        height="4.2"
        rx="1"
        fill="rgba(243,239,230,0.9)"
      />
    </svg>
  );
}

type Props = {
  worldId: string;
  /** Return false to cancel navigation (e.g. to ask about unsaved changes). */
  onNavigate?: (href: string) => boolean | void;
};

const TILES = [
  {
    key: "entries",
    label: "编辑词条",
    desc: "维护归属与词条正文、额外属性与卡片样式",
    icon: <EntryIcon />,
  },
  {
    key: "layout",
    label: "编辑 Wiki 界面",
    desc: "安排 Wiki 门面的区域、导航面板与整体排版",
    icon: <PageIcon />,
  },
] as const;

/** The two big entries into Wiki editing (词条库 / 排版编辑器). */
export default function WikiTiles({ worldId, onNavigate }: Props) {
  return (
    <div className={styles.grid}>
      {TILES.map((tile) => {
        const href =
          tile.key === "entries"
            ? `/worlds/${worldId}/entries`
            : `/worlds/${worldId}/wiki`;
        return (
          <Link
            key={tile.key}
            href={href}
            className={styles.tile}
            onClick={(e) => {
              if (onNavigate && onNavigate(href) === false) e.preventDefault();
            }}
          >
            <span className={styles.tileArt} aria-hidden="true">
              {tile.icon}
            </span>
            <span className={styles.tileText}>
              <span className={styles.tileLabel}>{tile.label}</span>
              <span className={styles.rule} />
              <span className={styles.tileDesc}>{tile.desc}</span>
            </span>
          </Link>
        );
      })}
    </div>
  );
}
