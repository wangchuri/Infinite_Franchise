"use client";

import { useRef, useState } from "react";
import { BLOCK_META, type PropField } from "@/lib/block-meta";
import type { WorldCollection } from "@/lib/collections";
import { uploadImage, type WikiEntry } from "@/lib/worlds";
import MarkdownEditor from "./MarkdownEditor";
import styles from "./block-fields.module.css";

type Props = {
  block: { id: string; type: string; props?: Record<string, unknown> };
  onChange: (key: string, value: unknown) => void;
  collections?: WorldCollection[];
  entries?: WikiEntry[];
  onError?: (message: string) => void;
  onCreateCollection?: (name: string) => Promise<WorldCollection | null>;
};

function asString(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asStringArray(v: unknown): string[] {
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : [];
}

/** Renders a block's Inspector fields from BLOCK_META (shared by both editors). */
export default function BlockFields({
  block,
  onChange,
  collections = [],
  entries = [],
  onError,
  onCreateCollection,
}: Props) {
  const meta = BLOCK_META[block.type as keyof typeof BLOCK_META];
  const fields = meta?.fields ?? [];
  if (fields.length === 0) {
    return <p className={styles.empty}>这个区域没有可调属性。</p>;
  }
  return (
    <>
      {fields.map((field) => (
        <Field
          key={field.key}
          field={field}
          value={block.props?.[field.key]}
          onChange={(v) => onChange(field.key, v)}
          collections={collections}
          entries={entries}
          onError={onError}
          onCreateCollection={onCreateCollection}
        />
      ))}
    </>
  );
}

function Field({
  field,
  value,
  onChange,
  collections,
  entries,
  onError,
  onCreateCollection,
}: {
  field: PropField;
  value: unknown;
  onChange: (value: unknown) => void;
  collections: WorldCollection[];
  entries: WikiEntry[];
  onError?: (message: string) => void;
  onCreateCollection?: (name: string) => Promise<WorldCollection | null>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");

  async function upload(file: File | undefined, apply: (url: string) => void) {
    if (!file) return;
    try {
      apply(await uploadImage(file));
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "上传失败");
    }
  }

  async function commitCollection() {
    const name = newName.trim();
    if (!name || !onCreateCollection) return;
    const created = await onCreateCollection(name);
    if (created) {
      onChange(created.key);
      setCreating(false);
      setNewName("");
    }
  }

  if (field.type === "textarea") {
    return (
      <label className={styles.field}>
        <span>{field.label}</span>
        <textarea
          rows={8}
          spellCheck={false}
          value={asString(value)}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>
    );
  }

  if (field.type === "markdown") {
    return (
      <div className={styles.field}>
        <span>{field.label}</span>
        <MarkdownEditor
          value={asString(value)}
          onChange={onChange}
          entries={entries}
          collections={collections}
          placeholder={field.placeholder}
        />
      </div>
    );
  }

  if (field.type === "lines") {
    return (
      <label className={styles.field}>
        <span>{field.label}</span>
        <textarea
          rows={4}
          spellCheck={false}
          value={asStringArray(value).join("\n")}
          placeholder={field.placeholder}
          onChange={(e) =>
            onChange(
              e.target.value
                .split("\n")
                .map((line) => line.trim())
                .filter(Boolean),
            )
          }
        />
      </label>
    );
  }

  if (field.type === "boolean") {
    return (
      <label className={styles.check}>
        <input
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
        />
        {field.label}
      </label>
    );
  }

  if (field.type === "select") {
    return (
      <label className={styles.field}>
        <span>{field.label}</span>
        <select value={asString(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
    );
  }

  if (field.type === "collection") {
    return (
      <div className={styles.field}>
        <span>{field.label}</span>
        <select value={asString(value)} onChange={(e) => onChange(e.target.value)}>
          <option value="">—</option>
          {collections.map((c) => (
            <option key={c.id} value={c.key}>
              {c.name}
              {c.hidden ? "（隐藏）" : ""}
            </option>
          ))}
        </select>
        {onCreateCollection ? (
          creating ? (
            <div className={styles.inlineCreate}>
              <input
                autoFocus
                value={newName}
                placeholder="归属名称，如 交易"
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void commitCollection();
                  else if (e.key === "Escape") {
                    setCreating(false);
                    setNewName("");
                  }
                }}
              />
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => void commitCollection()}
              >
                确定
              </button>
              <button
                type="button"
                className={styles.miniBtn}
                onClick={() => {
                  setCreating(false);
                  setNewName("");
                }}
              >
                取消
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={styles.linkBtn}
              onClick={() => {
                setCreating(true);
                setNewName("");
              }}
            >
              + 新建归属
            </button>
          )
        ) : null}
      </div>
    );
  }

  if (field.type === "image") {
    const url = asString(value);
    return (
      <div className={styles.field}>
        <span>{field.label}</span>
        <div className={styles.imageRow}>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="" className={styles.thumb} />
          ) : (
            <span className={styles.thumbEmpty}>无图</span>
          )}
          <button
            type="button"
            className={styles.miniBtn}
            onClick={() => fileRef.current?.click()}
          >
            上传
          </button>
          {url ? (
            <button
              type="button"
              className={styles.miniBtn}
              onClick={() => onChange("")}
            >
              清除
            </button>
          ) : null}
        </div>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0], (u) => onChange(u));
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  if (field.type === "imageList") {
    const urls = asStringArray(value);
    return (
      <div className={styles.field}>
        <span>{field.label}</span>
        <div className={styles.imageGrid}>
          {urls.map((u, i) => (
            <div key={`${u}-${i}`} className={styles.imageCell}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={u} alt="" className={styles.thumb} />
              <button
                type="button"
                className={styles.removeBadge}
                aria-label="移除"
                onClick={() => onChange(urls.filter((_, j) => j !== i))}
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className={styles.miniBtn}
          onClick={() => fileRef.current?.click()}
        >
          + 上传图片
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          hidden
          onChange={(e) => {
            void upload(e.target.files?.[0], (u) => onChange([...urls, u]));
            e.target.value = "";
          }}
        />
      </div>
    );
  }

  if (field.type === "entryList") {
    const slugs = asStringArray(value);
    return (
      <div className={styles.field}>
        <span>{field.label}</span>
        {entries.length === 0 ? (
          <p className={styles.empty}>本世界还没有词条。</p>
        ) : (
          <div className={styles.entryPicker}>
            {entries.map((e) => {
              const on = slugs.includes(e.slug);
              return (
                <label key={e.id} className={on ? styles.entryOn : styles.entryItem}>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() =>
                      onChange(
                        on
                          ? slugs.filter((s) => s !== e.slug)
                          : [...slugs, e.slug],
                      )
                    }
                  />
                  {e.title}
                </label>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  return (
    <label className={styles.field}>
      <span>{field.label}</span>
      <input
        value={asString(value)}
        placeholder={field.placeholder}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  );
}
