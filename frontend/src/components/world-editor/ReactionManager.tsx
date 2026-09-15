"use client";

import { useEffect, useState } from "react";
import {
  createWorldReactionType,
  deleteWorldReactionType,
  fetchWorldReactionTypes,
  updateWorldReactionType,
  type WorldReactionType,
} from "@/lib/reactions";
import styles from "./ReactionManager.module.css";

type Props = {
  worldId: string;
};

export default function ReactionManager({ worldId }: Props) {
  const [types, setTypes] = useState<WorldReactionType[]>([]);
  const [label, setLabel] = useState("");
  const [icon, setIcon] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const list = await fetchWorldReactionTypes(worldId);
        if (!cancelled) setTypes(list);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "加载失败");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [worldId]);

  async function onAdd() {
    const l = label.trim().slice(0, 24);
    const i = icon.trim().slice(0, 16);
    if (!l || !i) {
      setError("请填写表情和名称");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await createWorldReactionType(worldId, {
        label: l,
        icon: i,
      });
      setTypes((prev) => [...prev, created]);
      setLabel("");
      setIcon("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "添加失败");
    } finally {
      setBusy(false);
    }
  }

  async function onToggle(t: WorldReactionType) {
    setBusy(true);
    setError(null);
    try {
      const next = await updateWorldReactionType(worldId, t.id, {
        active: !t.active,
      });
      setTypes((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusy(false);
    }
  }

  async function onRename(t: WorldReactionType, nextLabel: string) {
    const l = nextLabel.trim().slice(0, 24);
    if (!l || l === t.label) return;
    try {
      const next = await updateWorldReactionType(worldId, t.id, { label: l });
      setTypes((prev) => prev.map((x) => (x.id === next.id ? next : x)));
    } catch (err) {
      setError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function onDelete(t: WorldReactionType) {
    setBusy(true);
    setError(null);
    try {
      await deleteWorldReactionType(worldId, t.id);
      setTypes((prev) => prev.filter((x) => x.id !== t.id));
    } catch (err) {
      setError(err instanceof Error ? err.message : "删除失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.title}>自定义反应</h2>
          <p className={styles.lead}>
            让这个世界拥有专属的表情。作品 / 词条 / 时间线的反应条会自动展示它们。
          </p>
        </div>
      </div>

      <div className={styles.addRow}>
        <input
          className={styles.iconInput}
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          placeholder="😀"
          maxLength={8}
          aria-label="表情"
        />
        <input
          className={styles.labelInput}
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="反应名称，如「名场面」"
          maxLength={24}
          aria-label="名称"
        />
        <button
          type="button"
          className={styles.addBtn}
          disabled={busy}
          onClick={() => void onAdd()}
        >
          添加
        </button>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}

      {types.length === 0 ? (
        <p className={styles.empty}>还没有自定义反应。</p>
      ) : (
        <ul className={styles.list}>
          {types.map((t) => (
            <li key={t.id} className={t.active ? styles.item : styles.itemOff}>
              <span className={styles.itemIcon} aria-hidden="true">
                {t.icon}
              </span>
              <input
                className={styles.itemLabel}
                defaultValue={t.label}
                maxLength={24}
                onBlur={(e) => void onRename(t, e.target.value)}
                aria-label="反应名称"
              />
              <button
                type="button"
                className={styles.toggle}
                disabled={busy}
                onClick={() => void onToggle(t)}
              >
                {t.active ? "启用中" : "已停用"}
              </button>
              <button
                type="button"
                className={styles.del}
                disabled={busy}
                onClick={() => void onDelete(t)}
              >
                删除
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
