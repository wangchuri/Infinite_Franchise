"use client";

import ReactMarkdown from "react-markdown";
import { EntryRefLink, matchEntryHref } from "./EntryHoverCard";
import type { WorldCollection } from "@/lib/collections";
import { linkifyEntryRefs } from "@/lib/entry-links";
import type { WikiEntry } from "@/lib/worlds";
import styles from "./MarkdownView.module.css";

export default function MarkdownView({
  content,
  className,
  worldSlug,
  entries,
  collections,
}: {
  content: string;
  className?: string;
  /** When provided, `[[词条名]]` links render with a hover info card. */
  worldSlug?: string;
  entries?: WikiEntry[];
  collections?: WorldCollection[];
}) {
  if (!content.trim()) {
    return <p className={styles.empty}>暂无内容</p>;
  }

  const markdown =
    worldSlug && entries
      ? linkifyEntryRefs(content, worldSlug, entries)
      : content;

  return (
    <div className={className ? `${styles.md} ${className}` : styles.md}>
      <ReactMarkdown
        components={{
          a: ({ href, children }) => {
            const entry = matchEntryHref(href, worldSlug, entries);
            if (entry && href) {
              return (
                <EntryRefLink href={href} entry={entry} collections={collections}>
                  {children}
                </EntryRefLink>
              );
            }
            return <a href={href}>{children}</a>;
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </div>
  );
}
