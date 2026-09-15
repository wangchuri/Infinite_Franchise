"use client";

import { useRef, useState, type ReactNode } from "react";
import { collectionName, type WorldCollection } from "@/lib/collections";
import { excerpt, type WikiEntry } from "@/lib/worlds";
import styles from "./entry-link.module.css";

const CARD_W = 268;

/** An entry reference link that shows an info card on hover/focus. */
export function EntryRefLink({
  href,
  entry,
  collections,
  children,
}: {
  href: string;
  entry: WikiEntry;
  collections?: WorldCollection[];
  children: ReactNode;
}) {
  const ref = useRef<HTMLAnchorElement>(null);
  const [pos, setPos] = useState<{
    left: number;
    top?: number;
    bottom?: number;
  } | null>(null);

  function show() {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - CARD_W - 8));
    // Prefer above the link; fall back below when there isn't room.
    if (r.top > 160) {
      setPos({ left, bottom: window.innerHeight - r.top + 8 });
    } else {
      setPos({ left, top: r.bottom + 8 });
    }
  }

  const name = collectionName(collections, entry.category);
  const summary = excerpt(entry.content, 72);

  return (
    <a
      ref={ref}
      href={href}
      className={styles.ref}
      onMouseEnter={show}
      onMouseLeave={() => setPos(null)}
      onFocus={show}
      onBlur={() => setPos(null)}
    >
      {children}
      {pos ? (
        <span
          className={styles.pop}
          style={{ left: pos.left, top: pos.top, bottom: pos.bottom }}
          role="tooltip"
        >
          {entry.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={entry.imageUrl} alt="" className={styles.popImg} />
          ) : (
            <span className={styles.popImgEmpty}>{entry.title.slice(0, 1)}</span>
          )}
          <span className={styles.popBody}>
            <strong className={styles.popTitle}>{entry.title}</strong>
            <span className={styles.popCat}>{name}</span>
            {summary ? <span className={styles.popText}>{summary}</span> : null}
          </span>
        </span>
      ) : null}
    </a>
  );
}

/** Match an entry page href (`/w/<world>/entry/<slug>`) to an entry. */
export function matchEntryHref(
  href: string | undefined,
  worldSlug: string | undefined,
  entries: WikiEntry[] | undefined,
): WikiEntry | null {
  if (!href || !worldSlug || !entries) return null;
  const m = /^\/w\/([^/]+)\/entry\/([^/?#]+)/.exec(href);
  if (!m || m[1] !== worldSlug) return null;
  const slug = decodeURIComponent(m[2]);
  return entries.find((e) => e.slug === slug) ?? null;
}
