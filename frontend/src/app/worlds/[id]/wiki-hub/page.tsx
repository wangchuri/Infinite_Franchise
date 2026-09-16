"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import WikiTiles from "@/components/WikiTiles";
import { getAccessToken } from "@/lib/auth";
import { fetchWorldById, type World } from "@/lib/worlds";
import styles from "./wiki-hub.module.css";

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
        <h1 className={styles.title}>编辑世界观</h1>
        <p className={styles.lead}>选择要编辑的部分。</p>
      </header>

      <WikiTiles worldId={world.id} />
    </div>
  );
}
