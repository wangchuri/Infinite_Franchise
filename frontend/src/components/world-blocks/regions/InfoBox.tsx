"use client";

import type { LayoutSection } from "@/lib/world-layout";
import type { WikiEntry } from "@/lib/worlds";
import { useWorldBlocks } from "../WorldBlocksProvider";
import { cx, unique } from "../shared";
import styles from "../blocks.module.css";

function itemsOf(
  section: LayoutSection,
  byCategory: Record<string, WikiEntry[]>,
): WikiEntry[] {
  return section.category ? (byCategory[section.category] ?? []) : [];
}

export function InfoBox() {
  const {
    world,
    entries,
    sections,
    activeId,
    timeline,
    works,
    config,
    byCategory,
  } = useWorldBlocks();
  const tags = config.showTags ? unique(world.tags.filter(Boolean)) : [];
  const settings = sections.filter(
    (s) => s.type === "entryGrid" || s.type === "glossary",
  );

  return (
    <>
      <div className={styles.infobox}>
        {world.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={world.logoUrl} alt="" className={styles.infoboxLogo} />
        ) : (
          <div className={styles.infoboxLogoEmpty}>
            {world.name.slice(0, 1)}
          </div>
        )}
        <strong className={styles.infoboxName}>{world.name}</strong>
        {world.tagline ? (
          <p className={styles.infoboxTagline}>{world.tagline}</p>
        ) : null}
      </div>

      {world.description ? (
        <div className={styles.infoCard}>
          <p className={styles.infoCardTitle}>关于</p>
          <p className={styles.infoCardBody}>{world.description}</p>
        </div>
      ) : null}

      <div className={styles.infoCard}>
        <p className={styles.infoCardTitle}>统计</p>
        <dl className={styles.stats}>
          <div>
            <dt>词条</dt>
            <dd>{entries.length}</dd>
          </div>
          {settings.map((s) => (
            <div key={s.id}>
              <dt>{s.label}</dt>
              <dd>{itemsOf(s, byCategory).length}</dd>
            </div>
          ))}
          {timeline.length > 0 ? (
            <div>
              <dt>时间轴</dt>
              <dd>{timeline.length}</dd>
            </div>
          ) : null}
          {works.length > 0 ? (
            <div>
              <dt>作品</dt>
              <dd>{works.length}</dd>
            </div>
          ) : null}
        </dl>
      </div>

      {tags.length > 0 ? (
        <div className={styles.infoCard}>
          <p className={styles.infoCardTitle}>标签</p>
          <div className={styles.tagList}>
            {tags.map((t, i) => (
              <span key={`${t}-${i}`} className={styles.tagChip}>
                #{t}
              </span>
            ))}
          </div>
        </div>
      ) : null}

      {sections.length > 0 ? (
        <div className={styles.infoCard}>
          <p className={styles.infoCardTitle}>本页目录</p>
          <ul className={styles.toc}>
            {sections.map((s) => (
              <li key={s.id}>
                <a
                  href={`#${s.id}`}
                  className={cx(
                    styles.tocLink,
                    activeId === s.id && styles.tocLinkOn,
                  )}
                >
                  {s.label}
                </a>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </>
  );
}
