"use client";

import type { LayoutSection } from "@/lib/world-layout";
import type { WikiEntry } from "@/lib/worlds";
import { useWorldBlocks } from "../WorldBlocksProvider";
import { cx } from "../shared";
import styles from "../blocks.module.css";

function itemsOf(
  section: LayoutSection,
  byCategory: Record<string, WikiEntry[]>,
): WikiEntry[] {
  return section.category ? (byCategory[section.category] ?? []) : [];
}

export function Nav() {
  const { sections, activeId, byCategory } = useWorldBlocks();
  const primary = sections.filter((s) => s.type === "prose");
  const settings = sections.filter(
    (s) => s.type === "entryGrid" || s.type === "glossary",
  );
  const structure = sections.filter(
    (s) =>
      s.type === "timeline" ||
      s.type === "eventAxis" ||
      s.type === "workList",
  );

  return (
    <nav className={styles.nav} aria-label="世界目录">
      {primary.length > 0 ? (
        <>
          <p className={styles.navGroupTitle}>导航</p>
          <ul className={styles.navList}>
            {primary.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={cx(
                    styles.navLink,
                    activeId === s.id && styles.navLinkOn,
                  )}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}

      {settings.length > 0 ? (
        <>
          <p className={styles.navGroupTitle}>设定</p>
          {settings.map((s) => {
            const items = itemsOf(s, byCategory);
            return (
              <div key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={cx(
                    styles.navLink,
                    activeId === s.id && styles.navLinkOn,
                  )}
                >
                  {s.label}
                  {items.length > 0 ? (
                    <span className={styles.navCount}>{items.length}</span>
                  ) : null}
                </a>
                {items.length > 0 ? (
                  <ul className={styles.navSubList}>
                    {items.map((e) => (
                      <li key={e.id}>
                        <a
                          href={`#entry-${e.slug}`}
                          className={styles.navSubLink}
                        >
                          {e.title}
                        </a>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
            );
          })}
        </>
      ) : null}

      {structure.length > 0 ? (
        <>
          <p className={styles.navGroupTitle}>结构</p>
          <ul className={styles.navList}>
            {structure.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={cx(
                    styles.navLink,
                    activeId === s.id && styles.navLinkOn,
                  )}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </nav>
  );
}
