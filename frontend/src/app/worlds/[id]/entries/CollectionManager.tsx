"use client";

import { useState } from "react";
import {
  createCollection,
  deleteCollection,
  updateCollection,
  type CollectionAttrField,
  type WorldCollection,
} from "@/lib/collections";
import { uploadImage } from "@/lib/worlds";
import styles from "./entries.module.css";

function CollectionCard({
  worldId,
  collection,
  entryCount,
  onUpdated,
  onDeleted,
  onError,
}: {
  worldId: string;
  collection: WorldCollection;
  entryCount: number;
  onUpdated: (c: WorldCollection) => void;
  onDeleted: (id: string) => void;
  onError: (msg: string) => void;
}) {
  const [name, setName] = useState(collection.name);
  const [iconUrl, setIconUrl] = useState(collection.iconUrl ?? "");
  const [hidden, setHidden] = useState(collection.hidden);
  const [fields, setFields] = useState<CollectionAttrField[]>(collection.attrFields);
  const [synced, setSynced] = useState(collection);
  const [confirming, setConfirming] = useState(false);

  // Adjust local drafts when the collection prop is replaced by a save.
  if (synced !== collection) {
    setSynced(collection);
    setName(collection.name);
    setIconUrl(collection.iconUrl ?? "");
    setHidden(collection.hidden);
    setFields(collection.attrFields);
  }

  async function save(patch: Parameters<typeof updateCollection>[2]) {
    try {
      onUpdated(await updateCollection(worldId, collection.id, patch));
    } catch (err) {
      onError(err instanceof Error ? err.message : "保存失败");
    }
  }

  async function onPickIcon(file?: File) {
    if (!file) return;
    try {
      const url = await uploadImage(file);
      setIconUrl(url);
      await save({ iconUrl: url });
    } catch (err) {
      onError(err instanceof Error ? err.message : "上传失败");
    }
  }

  async function remove() {
    try {
      await deleteCollection(worldId, collection.id);
      onDeleted(collection.id);
    } catch (err) {
      onError(err instanceof Error ? err.message : "删除失败");
    }
  }

  return (
    <div className={styles.colCard}>
      <div className={styles.colHead}>
        <input
          className={styles.colName}
          value={name}
          maxLength={60}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => {
            if (name.trim() && name.trim() !== collection.name) {
              void save({ name: name.trim() });
            }
          }}
        />
        <span className={styles.muted}>{entryCount} 词条</span>
      </div>

      <div className={styles.colRow}>
        <span className={styles.miniLabel}>图标</span>
        <input type="file" accept="image/*" onChange={(e) => void onPickIcon(e.target.files?.[0])} />
        {iconUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={iconUrl} alt="" className={styles.colIcon} />
        ) : null}
      </div>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={hidden}
          onChange={(e) => {
            setHidden(e.target.checked);
            void save({ hidden: e.target.checked });
          }}
        />
        隐藏（不在导航与分类页展示）
      </label>

      <div className={styles.subHead}>额外属性</div>
      {fields.map((f, i) => (
        <div key={i} className={styles.row2}>
          <input
            className={styles.mini}
            value={f.key}
            placeholder="key"
            onChange={(e) =>
              setFields((prev) =>
                prev.map((x, j) => (j === i ? { ...x, key: e.target.value } : x)),
              )
            }
            onBlur={() => void save({ attrFields: fields })}
          />
          <input
            className={styles.mini}
            value={f.label}
            placeholder="标签"
            onChange={(e) =>
              setFields((prev) =>
                prev.map((x, j) => (j === i ? { ...x, label: e.target.value } : x)),
              )
            }
            onBlur={() => void save({ attrFields: fields })}
          />
          <button
            type="button"
            className={styles.iconBtn}
            onClick={() => {
              const next = fields.filter((_, j) => j !== i);
              setFields(next);
              void save({ attrFields: next });
            }}
          >
            ×
          </button>
        </div>
      ))}
      <button
        type="button"
        className={styles.linkBtn}
        onClick={() =>
          setFields((prev) => [
            ...prev,
            { key: `field${prev.length + 1}`, label: "新属性" },
          ])
        }
      >
        + 属性字段
      </button>

      <div className={styles.colActions}>
        {collection.isBuiltin ? (
          <span className={styles.muted}>内置归属不可删除，可改名或隐藏</span>
        ) : confirming ? (
          <span className={styles.confirmRow}>
            删除「{collection.name}」？
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => void remove()}
            >
              确定
            </button>
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => setConfirming(false)}
            >
              取消
            </button>
          </span>
        ) : (
          <button
            type="button"
            className={styles.dangerBtn}
            onClick={() => setConfirming(true)}
          >
            删除归属
          </button>
        )}
      </div>
    </div>
  );
}

export default function CollectionManager({
  worldId,
  collections,
  counts,
  onChange,
  onError,
}: {
  worldId: string;
  collections: WorldCollection[];
  counts: Record<string, number>;
  onChange: (collections: WorldCollection[]) => void;
  onError: (msg: string) => void;
}) {
  const [newName, setNewName] = useState("");

  async function add() {
    const name = newName.trim();
    if (!name) return;
    try {
      const created = await createCollection(worldId, { name });
      onChange([...collections, created]);
      setNewName("");
    } catch (err) {
      onError(err instanceof Error ? err.message : "创建失败");
    }
  }

  return (
    <div className={styles.manager}>
      <div className={styles.newCol}>
        <input
          value={newName}
          placeholder="新归属名称，如 交易"
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") void add();
          }}
        />
        <button type="button" className={styles.addBtn} onClick={() => void add()}>
          + 新建归属
        </button>
      </div>
      {collections.map((c) => (
        <CollectionCard
          key={c.id}
          worldId={worldId}
          collection={c}
          entryCount={counts[c.key] ?? 0}
          onUpdated={(next) =>
            onChange(collections.map((x) => (x.id === next.id ? next : x)))
          }
          onDeleted={(id) => onChange(collections.filter((x) => x.id !== id))}
          onError={onError}
        />
      ))}
    </div>
  );
}
