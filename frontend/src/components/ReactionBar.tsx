"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import {
  fetchReactionSummary,
  toggleReaction,
  type ReactionSummary,
  type ReactionTargetType,
  type ReactionType,
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
  const [busyKey, setBusyKey] = useState<string | null>(null);
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

  async function onToggle(key: string) {
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    setBusyKey(key);
    setError(null);
    try {
      const next = await toggleReaction(targetType, targetId, key);
      setSummary(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "操作失败");
    } finally {
      setBusyKey(null);
    }
  }

  if (!summary || summary.types.length === 0) return null;

  return (
    <div ref={barRef} className={`${styles.bar} ${compact ? styles.compact : ""}`} role="group" aria-label="回应">
      {summary.types.map((t) => {
        const mine = summary.mine.includes(t.key);
        const count = summary.counts[t.key] ?? 0;
        return (
          <button
            key={t.key}
            type="button"
            aria-pressed={mine}
            className={mine ? styles.on : styles.btn}
            disabled={busyKey !== null}
            onMouseEnter={(e) => showTip(t, e.currentTarget)}
            onMouseLeave={hideTip}
            onFocus={(e) => showTip(t, e.currentTarget)}
            onBlur={hideTip}
            onClick={() => void onToggle(t.key)}
          >
            <span className={styles.icon} aria-hidden="true">
              {t.icon}
            </span>
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
          <span className={styles.tipIcon}>{tip.def.icon}</span>
          <div>
            <strong>{tip.def.label}</strong>
            <p>{tip.def.description}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
