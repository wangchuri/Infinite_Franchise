"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import {
  announceReactions,
  fetchReactionSummary,
  toggleReaction,
  type ReactionSummary,
  type ReactionTargetType,
  type ReactionType,
} from "@/lib/reactions";
import styles from "./ReactionStampLayer.module.css";

type Stamp = {
  id: number;
  x: number;
  y: number;
  def: ReactionType;
  variant: "add" | "remove";
};
type Menu = { x: number; y: number; defs: ReactionType[] };

export default function ReactionStampLayer({
  targetType,
  targetId,
  hostRef,
}: {
  targetType: ReactionTargetType;
  targetId: string;
  hostRef: RefObject<HTMLElement | null>;
}) {
  const router = useRouter();
  const [summary, setSummary] = useState<ReactionSummary | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [stamps, setStamps] = useState<Stamp[]>([]);
  const menuRef = useRef<HTMLDivElement>(null);
  const seq = useRef(0);
  const busy = useRef(false);

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
    };
  }, [targetType, targetId]);

  // Right-click inside the reading body opens the reaction bar at the cursor.
  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;
    function onContextMenu(e: MouseEvent) {
      if (!summary || summary.types.length === 0) return;
      const el = e.target as Element | null;
      if (el?.closest?.("a, button, input, textarea, select, video, audio, img")) {
        return;
      }
      e.preventDefault();
      setMenu({ x: e.clientX, y: e.clientY, defs: summary.types });
    }
    host.addEventListener("contextmenu", onContextMenu);
    return () => host.removeEventListener("contextmenu", onContextMenu);
  }, [hostRef, summary]);

  useEffect(() => {
    if (!menu) return;
    function close() {
      setMenu(null);
    }
    function onDown(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) close();
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  async function pick(def: ReactionType, x: number, y: number) {
    setMenu(null);
    if (!getAccessToken()) {
      router.push("/login");
      return;
    }
    const wasMine = summary?.mine.includes(def.id) ?? false;
    const id = (seq.current += 1);
    setStamps((list) => [
      ...list,
      { id, x, y, def, variant: wasMine ? "remove" : "add" },
    ]);
    if (busy.current) return;
    busy.current = true;
    try {
      const next = await toggleReaction(targetType, targetId, def.id);
      setSummary(next);
      announceReactions({ targetType, targetId, summary: next });
    } catch {
      /* keep the stamp; the count just won't change */
    } finally {
      busy.current = false;
    }
  }

  const menuStyle = menu
    ? (() => {
        const w = menu.defs.length * 58 + 14;
        const left = Math.min(
          Math.max(8, menu.x),
          Math.max(8, window.innerWidth - w - 8),
        );
        const top =
          menu.y + 78 > window.innerHeight
            ? Math.max(8, menu.y - 74)
            : menu.y + 8;
        return { left, top };
      })()
    : null;

  return (
    <>
      {menu && menuStyle ? (
        <div
          ref={menuRef}
          className={styles.menu}
          style={menuStyle}
          role="menu"
          aria-label="选择反应"
        >
          {menu.defs.map((d) => {
            const mine = summary?.mine.includes(d.id) ?? false;
            return (
              <button
                key={d.id}
                type="button"
                role="menuitemcheckbox"
                aria-checked={mine}
                className={
                  mine ? `${styles.item} ${styles.itemOn}` : styles.item
                }
                title={mine ? `${d.label}（点击取消）` : d.label}
                onClick={() => void pick(d, menu.x, menu.y)}
              >
                {d.kind === "artwork" && d.artworkUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={d.artworkUrl} alt="" className={styles.itemArt} />
                ) : (
                  <span className={styles.itemIcon} aria-hidden="true">
                    {d.icon}
                  </span>
                )}
                <span className={styles.itemLabel}>{d.label}</span>
                {mine ? (
                  <span className={styles.itemCheck} aria-hidden="true">
                    ✓
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : null}

      {stamps.map((s) => (
        <div
          key={s.id}
          className={`${styles.stamp} ${
            s.variant === "remove" ? styles.stampRemove : styles.stampAdd
          }`}
          style={{ left: s.x, top: s.y }}
          onAnimationEnd={(e) => {
            if (e.target !== e.currentTarget) return;
            setStamps((list) => list.filter((x) => x.id !== s.id));
          }}
        >
          {s.def.kind === "artwork" && s.def.artworkUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={s.def.artworkUrl} alt="" className={styles.stampArt} />
          ) : (
            <span className={styles.stampIcon} aria-hidden="true">
              {s.def.icon}
            </span>
          )}
        </div>
      ))}
    </>
  );
}
