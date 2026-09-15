"use client";

import { useRef, useState } from "react";
import { uploadImage } from "@/lib/worlds";
import styles from "./ImageUpload.module.css";

type Props = {
  label: string;
  value: string | null;
  onChange: (url: string | null) => void;
  aspect?: "square" | "wide" | "portrait";
};

export default function ImageUpload({
  label,
  value,
  onChange,
  aspect = "square",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const url = await uploadImage(file);
      onChange(url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={styles.wrap}>
      <span className={styles.label}>{label}</span>
      <button
        type="button"
        className={`${styles.box} ${styles[aspect]}`}
        onClick={() => inputRef.current?.click()}
        disabled={busy}
      >
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="" className={styles.img} />
        ) : (
          <span className={styles.placeholder}>
            {busy ? "上传中…" : "点击上传"}
          </span>
        )}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        hidden
        onChange={(e) => {
          void onFile(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
      {value ? (
        <div className={styles.actions}>
          <button
            type="button"
            className={styles.clear}
            onClick={() => inputRef.current?.click()}
          >
            更换
          </button>
          <button
            type="button"
            className={styles.clear}
            onClick={() => onChange(null)}
          >
            清除
          </button>
        </div>
      ) : null}
      {error ? <p className={styles.error}>{error}</p> : null}
    </div>
  );
}
