"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import { fetchWorldById, type World } from "@/lib/worlds";
import styles from "./wiki-hub.module.css";

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
      <path d="M14 3.5V8.3H19" fill="none" stroke="rgba(243,239,230,0.9)" strokeWidth="1.4" />
      <g stroke="rgba(243,239,230,0.9)" strokeWidth="1.5" strokeLinecap="round">
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
      <rect x="5.4" y="7" width="6" height="10" rx="1" fill="rgba(243,239,230,0.9)" />
      <rect x="13.2" y="7" width="5.4" height="4.4" rx="1" fill="rgba(243,239,230,0.9)" />
      <rect x="13.2" y="12.8" width="5.4" height="4.2" rx="1" fill="rgba(243,239,230,0.9)" />
    </svg>
  );
}

export default function WikiHubPage() {
  const params = useParams<{ id: string }>();
  const worldId = params.id;
  const router = useRouter();

  const [world, setWorld] = useState<World | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await fetchWorldById(worldId);
        if (cancelled) return;
        setWorld(data.world);
        setCanEdit(data.canEdit);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "加载失败");
      } finally {
        if (!cancelled) setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
  }, [router]);

  if (!ready) return <p className={styles.loading}>加载中…</p>;
  if (!world) return <p className={styles.error}>{error ?? "世界观不存在"}</p>;
  if (!canEdit) {
    return <p className={styles.error}>你没有编辑这个 Wiki 的权限。</p>;
  }

  return (
    <div className={styles.page}>
      <header className={styles.head}>
        <Link href={`/w/${world.slug}`} className={styles.back}>
          ← {world.name}
        </Link>
        <h1 className={styles.title}>编辑 Wiki</h1>
        <p className={styles.lead}>选择要编辑的部分。</p>
      </header>

      <div className={styles.grid}>
        <Link href={`/worlds/${world.id}/entries`} className={styles.tile}>
          <span className={styles.tileArt} aria-hidden="true">
            <EntryIcon />
          </span>
          <span className={styles.tileText}>
            <span className={styles.tileLabel}>编辑词条</span>
            <span className={styles.rule} />
            <span className={styles.tileDesc}>
              维护归属与词条正文、额外属性与卡片样式
            </span>
          </span>
        </Link>

        <Link href={`/worlds/${world.id}/wiki`} className={styles.tile}>
          <span className={styles.tileArt} aria-hidden="true">
            <PageIcon />
          </span>
          <span className={styles.tileText}>
            <span className={styles.tileLabel}>编辑页面</span>
            <span className={styles.rule} />
            <span className={styles.tileDesc}>
              安排 Wiki 主页的区域、导航面板与整体排版
            </span>
          </span>
        </Link>
      </div>
    </div>
  );
}
