"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReaderView from "@/components/reader/ReaderView";
import {
  fetchWorldWorks,
  fetchWorkRead,
  type Work,
  type WorkReadPayload,
} from "@/lib/works";
import { fetchWorldBySlug, type WikiEntry, type World } from "@/lib/worlds";
import type { WorldCollection } from "@/lib/collections";
import styles from "./work.module.css";

export default function WorkDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<WorkReadPayload | null>(null);
  const [world, setWorld] = useState<World | null>(null);
  const [entries, setEntries] = useState<WikiEntry[]>([]);
  const [collections, setCollections] = useState<WorldCollection[]>([]);
  const [others, setOthers] = useState<Work[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setReady(false);
      try {
        const payload = await fetchWorkRead(params.id);
        if (cancelled) return;
        setData(payload);
        setError(null);

        // World context: entry links in the body + related works. Best-effort.
        const [world, works] = await Promise.all([
          fetchWorldBySlug(payload.work.worldSlug).catch(() => null),
          fetchWorldWorks(payload.work.worldId, 24).catch(() => [] as Work[]),
        ]);
        if (cancelled) return;
        setEntries(world?.entries ?? []);
        setCollections(world?.collections ?? []);
        setWorld(world?.world ?? null);
        setOthers(
          works
            .filter((w) => w.id !== payload.work.id && !w.parentId)
            .slice(0, 6),
        );
      } catch (err) {
        if (!cancelled) {
          setData(null);
          setError(err instanceof Error ? err.message : "加载失败");
        }
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  if (!ready) {
    return (
      <div className={styles.page}>
        <p className={styles.muted}>打开阅读…</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.page}>
        <p className={styles.error}>{error ?? "作品不存在"}</p>
        <Link href="/">返回广场</Link>
      </div>
    );
  }

  return (
    <ReaderView
      data={data}
      world={world}
      entries={entries}
      collections={collections}
      others={others}
    />
  );
}
