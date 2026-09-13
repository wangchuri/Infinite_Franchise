"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import WorldCard from "@/components/WorldCard";
import { getAccessToken } from "@/lib/auth";
import {
  createWorld,
  deleteWorld,
  fetchMyWorlds,
  type World,
} from "@/lib/worlds";
import styles from "./worlds.module.css";

/** Only one auto-bootstrap at a time across Strict Mode remounts. */
let bootstrapInFlight: Promise<string> | null = null;

export default function WorldsHubPage() {
  const router = useRouter();
  const [worlds, setWorlds] = useState<World[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const drafts = useMemo(
    () => (worlds ?? []).filter((w) => w.status === "draft"),
    [worlds],
  );
  const published = useMemo(
    () => (worlds ?? []).filter((w) => w.status === "published"),
    [worlds],
  );

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!getAccessToken()) {
        router.replace("/login");
        return;
      }
      try {
        const list = await fetchMyWorlds();
        if (cancelled) return;

        // Has any world (draft or published) → show hub, never auto-create.
        if (list.length > 0) {
          setWorlds(list);
          return;
        }

        // No worlds at all → create one draft and enter editor (once).
        setBootstrapping(true);
        if (!bootstrapInFlight) {
          bootstrapInFlight = createWorld("未命名世界观").then((w) => w.id);
        }
        const id = await bootstrapInFlight;
        bootstrapInFlight = null;
        if (!cancelled) router.replace(`/worlds/${id}/edit`);
      } catch (err) {
        bootstrapInFlight = null;
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
          setWorlds([]);
          setBootstrapping(false);
        }
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [router]);

  async function onCreateNew() {
    // Explicit user action only — not triggered by opening「创建世界观」.
    setCreating(true);
    setError(null);
    try {
      const world = await createWorld("未命名世界观");
      router.push(`/worlds/${world.id}/edit`);
    } catch (err) {
      setCreating(false);
      setError(err instanceof Error ? err.message : "创建失败");
    }
  }

  async function onDeleteDraft(world: World) {
    const ok = window.confirm(
      `确定删除草稿「${world.name || "未命名世界观"}」？`,
    );
    if (!ok) return;
    setDeletingId(world.id);
    setError(null);
    try {
      await deleteWorld(world.id);
      setWorlds((prev) => (prev ?? []).filter((w) => w.id !== world.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setDeletingId(null);
    }
  }

  if (error && worlds === null) {
    return <p className={styles.error}>{error}</p>;
  }

  if (worlds === null || bootstrapping) {
    return (
      <p className={styles.loading}>
        {bootstrapping
          ? "还没有世界观，正在为你创建第一个…"
          : "加载我的世界观…"}
      </p>
    );
  }

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>My Worlds</p>
          <h1 className={styles.title}>我的世界观</h1>
          <p className={styles.lead}>
            点「创建世界观」会先来到这里。只有一个都没有时才会自动新建；再开新世界请用右侧按钮。
          </p>
        </div>
        <button
          type="button"
          className={styles.createBtn}
          disabled={creating}
          onClick={() => void onCreateNew()}
        >
          {creating ? "创建中…" : "再开一个新世界"}
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section className={styles.section}>
        <h2>草稿</h2>
        {drafts.length === 0 ? (
          <p className={styles.empty}>暂无草稿</p>
        ) : (
          <div className={styles.grid}>
            {drafts.map((w) => (
              <WorldCard
                key={w.id}
                world={w}
                href={`/worlds/${w.id}/edit`}
                actions={
                  <>
                    <Link href={`/worlds/${w.id}/edit`} className={styles.link}>
                      继续编辑
                    </Link>
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      disabled={deletingId === w.id}
                      onClick={() => void onDeleteDraft(w)}
                    >
                      {deletingId === w.id ? "删除中…" : "删除"}
                    </button>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h2>已发布</h2>
        {published.length === 0 ? (
          <p className={styles.empty}>还没有发布过世界观</p>
        ) : (
          <div className={styles.grid}>
            {published.map((w) => (
              <WorldCard
                key={w.id}
                world={w}
                href={`/w/${w.slug}`}
                actions={
                  <>
                    <Link href={`/w/${w.slug}/wiki`} className={styles.link}>
                      查看 Wiki
                    </Link>
                    <Link href={`/worlds/${w.id}/edit`} className={styles.link}>
                      编辑
                    </Link>
                  </>
                }
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
