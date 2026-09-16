"use client";

import { useRef, useState, type PointerEvent as ReactPointerEvent } from "react";
import { uploadImage } from "@/lib/worlds";
import styles from "./AvatarEditor.module.css";

const VIEW = 240; // square viewport (px)
const OUT = 512; // exported avatar size (px)

/** Avatar picker with a drag-to-pan / zoom crop step, uploaded as a square. */
export default function AvatarEditor({
  value,
  onChange,
  fallback = "?",
}: {
  value: string | null;
  onChange: (url: string | null) => void;
  fallback?: string;
}) {
  const viewRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );

  const [src, setSrc] = useState<string | null>(null);
  const [natural, setNatural] = useState<{ w: number; h: number } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const base = natural ? VIEW / Math.min(natural.w, natural.h) : 1;
  const dispW = natural ? natural.w * base * zoom : VIEW;
  const dispH = natural ? natural.h * base * zoom : VIEW;

  function clamp(x: number, y: number, w = dispW, h = dispH) {
    const mx = Math.max(0, (w - VIEW) / 2);
    const my = Math.max(0, (h - VIEW) / 2);
    return {
      x: Math.min(mx, Math.max(-mx, x)),
      y: Math.min(my, Math.max(-my, y)),
    };
  }

  function pick(file: File | undefined) {
    if (!file) return;
    setError(null);
    setSrc(URL.createObjectURL(file));
    setZoom(1);
    setOffset({ x: 0, y: 0 });
    setNatural(null);
  }

  function cancel() {
    if (src) URL.revokeObjectURL(src);
    setSrc(null);
    setNatural(null);
    setError(null);
  }

  function onLoad() {
    const img = imgRef.current;
    if (!img) return;
    setNatural({ w: img.naturalWidth, h: img.naturalHeight });
  }

  function onPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    drag.current = { x: e.clientX, y: e.clientY, ox: offset.x, oy: offset.y };
    e.currentTarget.setPointerCapture(e.pointerId);
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const d = drag.current;
    if (!d) return;
    setOffset(clamp(d.ox + (e.clientX - d.x), d.oy + (e.clientY - d.y)));
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    drag.current = null;
    if (e.currentTarget.hasPointerCapture(e.pointerId)) {
      e.currentTarget.releasePointerCapture(e.pointerId);
    }
  }

  async function save() {
    const img = imgRef.current;
    if (!img || !natural) return;
    setBusy(true);
    setError(null);
    try {
      const k = OUT / VIEW;
      const dw = natural.w * base * zoom;
      const dh = natural.h * base * zoom;
      const dx = (VIEW / 2 - dw / 2 + offset.x) * k;
      const dy = (VIEW / 2 - dh / 2 + offset.y) * k;
      const canvas = document.createElement("canvas");
      canvas.width = OUT;
      canvas.height = OUT;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("无法处理图片");
      ctx.fillStyle = "#fffef9";
      ctx.fillRect(0, 0, OUT, OUT);
      ctx.drawImage(img, dx, dy, dw * k, dh * k);
      const blob = await new Promise<Blob | null>((res) =>
        canvas.toBlob(res, "image/jpeg", 0.92),
      );
      if (!blob) throw new Error("无法导出图片");
      const url = await uploadImage(
        new File([blob], "avatar.jpg", { type: "image/jpeg" }),
      );
      onChange(url);
      if (src) URL.revokeObjectURL(src);
      setSrc(null);
      setNatural(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "上传失败");
    } finally {
      setBusy(false);
    }
  }

  if (src) {
    return (
      <div className={styles.editor}>
        <div
          ref={viewRef}
          className={styles.viewport}
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            ref={imgRef}
            src={src}
            alt=""
            draggable={false}
            onLoad={onLoad}
            className={styles.img}
            style={{
              width: dispW,
              height: dispH,
              left: `calc(50% + ${offset.x}px)`,
              top: `calc(50% + ${offset.y}px)`,
            }}
          />
        </div>

        <label className={styles.zoom}>
          <span>缩放</span>
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => {
              const z = Number(e.target.value);
              setZoom(z);
              setOffset((o) =>
                clamp(
                  o.x,
                  o.y,
                  (natural?.w ?? 1) * base * z,
                  (natural?.h ?? 1) * base * z,
                ),
              );
            }}
          />
        </label>

        <p className={styles.hint}>拖动调整位置 · 滑动调整大小</p>
        {error ? <p className={styles.error}>{error}</p> : null}

        <div className={styles.actions}>
          <button
            type="button"
            className={styles.primary}
            disabled={busy || !natural}
            onClick={() => void save()}
          >
            {busy ? "上传中…" : "保存头像"}
          </button>
          <button
            type="button"
            className={styles.ghost}
            disabled={busy}
            onClick={cancel}
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.preview}>
      <span
        className={styles.avatar}
        style={value ? { backgroundImage: `url(${value})` } : undefined}
        aria-hidden="true"
      >
        {value ? "" : fallback}
      </span>
      <div className={styles.actions}>
        <label className={styles.ghost}>
          上传头像
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={(e) => {
              pick(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {value ? (
          <button
            type="button"
            className={styles.ghost}
            onClick={() => onChange(null)}
          >
            清除
          </button>
        ) : null}
      </div>
    </div>
  );
}
