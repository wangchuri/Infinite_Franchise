"use client";

import type { CSSProperties } from "react";
import MarkdownView from "@/components/MarkdownView";
import type { Block } from "@/lib/world-layout";
import { useWorldBlocks } from "../WorldBlocksProvider";
import styles from "../blocks.module.css";

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function strArray(v: unknown): string[] {
  return Array.isArray(v)
    ? v.filter((x): x is string => typeof x === "string" && x.length > 0)
    : [];
}

function Section({
  block,
  children,
}: {
  block: Block;
  children: React.ReactNode;
}) {
  return (
    <section id={block.id} className={styles.section}>
      {children}
    </section>
  );
}

export function Heading({ block }: { block: Block }) {
  const text = str(block.props?.text).trim();
  if (!text) return null;
  const level = block.props?.level === "3" ? 3 : 2;
  return (
    <Section block={block}>
      <div className={styles.contentHead}>
        {level === 3 ? <h3>{text}</h3> : <h2>{text}</h2>}
      </div>
    </Section>
  );
}

export function TextBlock({ block }: { block: Block }) {
  const { world, entries, collections } = useWorldBlocks();
  const markdown = str(block.props?.markdown);
  if (!markdown.trim()) return null;
  return (
    <Section block={block}>
      <div className={styles.contentText}>
        <MarkdownView
          content={markdown}
          worldSlug={world.slug}
          entries={entries}
          collections={collections}
        />
      </div>
    </Section>
  );
}

export function ImageBlock({ block }: { block: Block }) {
  const url = str(block.props?.url);
  if (!url) return null;
  const caption = str(block.props?.caption);
  const width = str(block.props?.width, "full");
  const align = str(block.props?.align, "center");
  const widthClass =
    width === "half"
      ? styles.wHalf
      : width === "third"
        ? styles.wThird
        : styles.wFull;
  const alignClass =
    align === "left"
      ? styles.aLeft
      : align === "right"
        ? styles.aRight
        : styles.aCenter;
  return (
    <figure id={block.id} className={`${styles.figure} ${widthClass} ${alignClass}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={url} alt={caption} className={styles.contentImg} />
      {caption ? <figcaption>{caption}</figcaption> : null}
    </figure>
  );
}

export function GalleryBlock({ block }: { block: Block }) {
  const urls = strArray(block.props?.urls);
  if (urls.length === 0) return null;
  const caption = str(block.props?.caption);
  const columns = str(block.props?.columns, "3");
  return (
    <Section block={block}>
      <div
        className={styles.gallery}
        style={{ "--gallery-cols": columns } as CSSProperties}
      >
        {urls.map((u, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={`${u}-${i}`} src={u} alt="" className={styles.galleryImg} />
        ))}
      </div>
      {caption ? <p className={styles.caption}>{caption}</p> : null}
    </Section>
  );
}

export function Quote({ block }: { block: Block }) {
  const text = str(block.props?.text).trim();
  if (!text) return null;
  const cite = str(block.props?.cite);
  return (
    <blockquote id={block.id} className={styles.quote}>
      <p>{text}</p>
      {cite ? <cite>— {cite}</cite> : null}
    </blockquote>
  );
}

export function Divider({ block }: { block: Block }) {
  const spacing = str(block.props?.spacing, "md");
  const cls =
    spacing === "sm"
      ? styles.spSm
      : spacing === "lg"
        ? styles.spLg
        : styles.spMd;
  return <hr id={block.id} className={`${styles.divider} ${cls}`} />;
}

export function Button({ block }: { block: Block }) {
  const label = str(block.props?.label).trim();
  if (!label) return null;
  const href = str(block.props?.href);
  const variant = str(block.props?.variant, "solid");
  const target = block.props?.target === "_blank" ? "_blank" : "_self";
  const cls = variant === "outline" ? styles.btnOutline : styles.btnSolid;
  return (
    <p id={block.id} className={styles.buttonWrap}>
      {href ? (
        <a
          href={href}
          target={target}
          rel={target === "_blank" ? "noopener noreferrer" : undefined}
          className={cls}
        >
          {label}
        </a>
      ) : (
        <span className={cls}>{label}</span>
      )}
    </p>
  );
}

function parseLink(raw: string): { label: string; href: string } | null {
  const [labelPart, hrefPart] = raw.split("|").map((s) => s.trim());
  if (!labelPart) return null;
  return { label: labelPart, href: hrefPart || "#" };
}

export function LinkList({ block }: { block: Block }) {
  const title = str(block.props?.title);
  const links = strArray(block.props?.items)
    .map(parseLink)
    .filter((l): l is { label: string; href: string } => l !== null);
  if (links.length === 0) return null;
  return (
    <Section block={block}>
      {title ? (
        <div className={styles.sectionBar}>
          <h2>{title}</h2>
        </div>
      ) : null}
      <ul className={styles.linkList}>
        {links.map((l, i) => (
          <li key={`${l.href}-${i}`}>
            <a href={l.href}>{l.label}</a>
          </li>
        ))}
      </ul>
    </Section>
  );
}

export function RelatedEntries({ block }: { block: Block }) {
  const { world, entries } = useWorldBlocks();
  const title = str(block.props?.title);
  const columns = str(block.props?.columns, "3");
  const slugs = strArray(block.props?.slugs);
  const picked = slugs
    .map((s) => entries.find((e) => e.slug === s))
    .filter((e): e is NonNullable<typeof e> => e !== undefined);
  if (picked.length === 0) return null;
  return (
    <Section block={block}>
      {title ? (
        <div className={styles.sectionBar}>
          <h2>{title}</h2>
        </div>
      ) : null}
      <div
        className={styles.navGrid}
        style={{ "--nav-cols": columns } as CSSProperties}
      >
        {picked.map((e) => (
          <a
            key={e.id}
            className={styles.navTile}
            href={`/w/${world.slug}/entry/${e.slug}`}
          >
            {e.imageUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={e.imageUrl} alt="" className={styles.navTileIcon} />
            ) : (
              <span className={styles.navTileIconEmpty}>
                {e.title.slice(0, 1)}
              </span>
            )}
            <span className={styles.navTileLabel}>{e.title}</span>
          </a>
        ))}
      </div>
    </Section>
  );
}
