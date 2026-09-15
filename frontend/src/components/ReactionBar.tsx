"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import {
  fetchReactionSummary,
  REACTIONS_CHANGED,
  toggleReaction,
  type ReactionSummary,
  type ReactionTargetType,
  type ReactionType,
  type ReactionsChangedDetail,
} from "@/lib/reactions";
import styles from "./ReactionBar.module.css";

type Props = {
  targetType: ReactionTargetType;
  targetId: string;
  compact?: boolean;
};

type TipState = {
  x: number;
  y: number;
  align: "left" | "right";
  def: ReactionType;
} | null;

export default function ReactionBar({ targetType, targetId, compact = false }: Props) {
  const router = useRouter();
  const barRef = useRef<HTMLDivElement>(null);
  const [summary, setSummary] = useState<ReactionSummary | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tip, setTip] = useState<TipState>(null);
  const hideTimer = useRef<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const s = await fetchReactionSummary(targetType, targetId);
        if (!cancelled) setSummary(s);
      } catch {
        if (!cancelled) setSummary(null);
      }
    })();
    return () => {
      cancelled = true;
      if (hideTimer.current) window.clearTimeout(hideTimer.current);
    };
  }, [targetType, targetId]);

  // Keep in sync when the same target is reacted to elsewhere (e.g. the
  // right-click stamp menu on the reading page).
  useEffect(() => {
    function onChanged(e: Event) {
      const d = (e as CustomEvent<ReactionsChangedDetail>).detail;
      if (d && d.targetType === targetType && d.targetId === targetId) {
        setSummary(d.summary);
      }
    }
    window.addEventListener(REACTIONS_CHANGED, onChanged);
    return () => window.removeEventListener(REACTIONS_CHANGED, onChanged);
  }, [targetType, targetId]);

  function showTip(def: ReactionType, btn: HTMLButtonElement) {
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    const r = btn.getBoundingClientRect();
    const bar = barRef.current?.getBoundingClientRect();
    const align: "left" | "right" =
      bar && r.right > bar.right ? "right" : "left";
    setTip({
      x: r.left + r.width / 2,
      y: r.top,
      align,
      def,
    });
  }

  function hideTip() {
    // small delay so moving from icon to tooltip doesn't flicker
    if (hideTimer.current) window.clearTimeout(hideTimer.current);
    hideTimer.current = window.setTimeout(() => setTip(null), 120);
  }

  async function onToggle(id: string) {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    setBusyId(id);
    setError(null);
    try {
      const next = await toggleReaction(targetType, targetId, id);
      setSummary(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyId(null);
    }
  }

  if (!summary || summary.types.length === 0) return null;

  return (
    <div ref={barRef} className={`${styles.bar} ${compact ? styles.compact : ""}`} role="group" aria-label="回应">
      {summary.types.map((t) => {
        const mine = summary.mine.includes(t.id);
        const count = summary.counts[t.id] ?? 0;
        const isLike = t.key === "like";
        const cls = [mine ? styles.on : styles.btn, isLike ? styles.like : ""]
          .filter(Boolean)
          .join(" ");
        return (
          <button
            key={t.id}
            type="button"
            aria-pressed={mine}
            className={cls}
            disabled={busyId !== null}
            onMouseEnter={(e) => showTip(t, e.currentTarget)}
            onMouseLeave={hideTip}
            onFocus={(e) => showTip(t, e.currentTarget)}
            onBlur={hideTip}
            onClick={() => void onToggle(t.id)}
          >
            {t.kind === "artwork" && t.artworkUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={t.artworkUrl} alt="" className={styles.sticker} />
            ) : (
              <span className={styles.icon} aria-hidden="true">
                {t.icon}
              </span>
            )}
            {!compact ? <span className={styles.label}>{t.label}</span> : null}
            <span className={styles.count}>{count}</span>
          </button>
        );
      })}
      {error ? <span className={styles.error}>{error}</span> : null}

      {tip ? (
        <div
          className={`${styles.tip} ${tip.align === "right" ? styles.tipRight : ""}`}
          style={{ left: tip.x, top: tip.y }}
          onMouseEnter={() => {
            if (hideTimer.current) window.clearTimeout(hideTimer.current);
          }}
          onMouseLeave={hideTip}
          role="tooltip"
        >
          {tip.def.kind === "artwork" && tip.def.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={tip.def.artworkUrl} alt="" className={styles.tipSticker} />
          ) : (
            <span className={styles.tipIcon}>{tip.def.icon}</span>
          )}
          <div>
            <strong>{tip.def.label}</strong>
            <p>{tip.def.description || "自定义表情"}</p>
            {tip.def.kind === "artwork" && tip.def.artworkId ? (
              <Link
                href={`/works/${tip.def.artworkId}`}
                className={styles.tipLink}
              >
                查看作品 →
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
