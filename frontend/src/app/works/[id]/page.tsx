"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import ReaderView from "@/components/reader/ReaderView";
import { fetchWorkRead, type WorkReadPayload } from "@/lib/works";
import styles from "./work.module.css";

export default function WorkDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<WorkReadPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setReady(false);
      try {
        const payload = await fetchWorkRead(params.id);
        if (!cancelled) {
          setData(payload);
          setError(null);
        }
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

  return <ReaderView data={data} />;
}
