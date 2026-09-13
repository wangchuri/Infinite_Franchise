"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import styles from "./lab.module.css";

type CreativeKind = {
  key: string;
  label: string;
  hint: string;
  numeral: string;
};

const KINDS: CreativeKind[] = [
  { key: "novel", label: "小说", hint: "短篇 · 长篇 · 章节", numeral: "I" },
  { key: "artwork", label: "美术", hint: "插画 · 设定 · 封面", numeral: "II" },
  { key: "program", label: "程序", hint: "工具 · 互动 · 玩法", numeral: "III" },
  { key: "audio", label: "音频", hint: "音乐 · 配音 · 音效", numeral: "IV" },
];

const KIND_BY_KEY = new Map(KINDS.map((k) => [k.key, k]));

/** Card transition window — return (0.5s) then incoming (80ms delay + 0.5s). */
const FLIP_MS = 600;

function kindOf(key: string): CreativeKind {
  return KIND_BY_KEY.get(key) ?? KINDS[0];
}

/** Paper-toned glyphs (cards supply the colored ground). */
function KindIcon({ kind }: { kind: string }) {
  switch (kind) {
    case "novel":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <path
            d="M4 20.5 4.8 16.6 15.9 5.5a1.6 1.6 0 0 1 2.3 0l1.3 1.3a1.6 1.6 0 0 1 0 2.3L8.4 20.2 4 20.5z"
            fill="var(--paper)"
          />
          <path
            d="M4 20.5 4.8 16.6 8.4 20.2 4 20.5z"
            fill="var(--paper)"
            fillOpacity="0.5"
          />
          <path
            d="M13.7 7.7 16.3 10.3"
            stroke="rgba(20,33,43,0.25)"
            strokeWidth="1.4"
            strokeLinecap="round"
          />
        </svg>
      );
    case "artwork":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <path
            d="M12 3a9 9 0 1 0 0 18c1.2 0 2-.9 2-2 0-.5-.2-.9-.5-1.3-.3-.4-.5-.8-.5-1.2 0-.9.7-1.5 1.6-1.5H16a5 5 0 0 0 5-5c0-3.9-4-7-9-7z"
            fill="var(--paper)"
          />
          <circle cx="7.6" cy="11.2" r="1.25" fill="var(--paper)" fillOpacity="0.5" />
          <circle cx="10.6" cy="7.4" r="1.25" fill="var(--paper)" fillOpacity="0.5" />
          <circle cx="15.2" cy="8" r="1.25" fill="rgba(20,33,43,0.28)" />
        </svg>
      );
    case "program":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <path
            d="M8.5 6.5 3.5 12l5 5.5"
            fill="none"
            stroke="var(--paper)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M15.5 6.5 20.5 12l-5 5.5"
            fill="none"
            stroke="var(--paper)"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M13.2 5 10.8 19"
            fill="none"
            stroke="var(--paper)"
            strokeOpacity="0.5"
            strokeWidth="2.2"
            strokeLinecap="round"
          />
        </svg>
      );
    case "audio":
      return (
        <svg
          viewBox="0 0 24 24"
          preserveAspectRatio="xMidYMid meet"
          className={styles.icon}
          aria-hidden="true"
        >
          <g
            stroke="var(--paper)"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          >
            <path d="M5 10v4" />
            <path d="M9 7v10" />
            <path d="M13 5v14" />
            <path d="M17 8v8" />
          </g>
          <path
            d="M21 10v4"
            stroke="var(--paper)"
            strokeOpacity="0.5"
            strokeWidth="2.2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    default:
      return null;
  }
}

function CardFace({ kind }: { kind: CreativeKind }) {
  return (
    <>
      <span className={styles.frame} aria-hidden="true" />
      <span className={styles.face}>
        <span className={styles.faceNumeral}>· {kind.numeral} ·</span>
        <span className={styles.faceIcon}>
          <KindIcon kind={kind.key} />
        </span>
        <span className={styles.faceFoot}>
          <span className={styles.faceRule} aria-hidden="true" />
          <span className={styles.faceLabel}>{kind.label}</span>
          <span className={styles.faceHint}>{kind.hint}</span>
        </span>
      </span>
    </>
  );
}

export default function CreateLabPage() {
  const router = useRouter();
  const [deck, setDeck] = useState<string[]>(KINDS.map((k) => k.key));
  const [leaving, setLeaving] = useState<string | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
  }, [router]);

  const activeKey = deck[0];
  const active = kindOf(activeKey);

  function advance() {
    if (leaving) return;
    const out = deck[0];
    setSelected(null);
    setLeaving(out);
    // Drop the outgoing card now so the next one becomes active immediately,
    // letting both cards fly at the same time.
    setDeck((prev) => prev.slice(1));
    window.setTimeout(() => {
      setDeck((prev) => [...prev, out]);
      setLeaving(null);
    }, FLIP_MS);
  }

  function select() {
    if (leaving) return;
    setSelected((prev) => (prev === activeKey ? null : activeKey));
  }

  function confirm() {
    if (selected) router.push(`/create/${selected}`);
  }

  return (
    <div className={styles.page}>
      <div className={styles.board}>
        <div className={styles.activeSlot}>
          {leaving ? (
            <div
              key={leaving}
              className={`${styles.cardWrap} ${styles.leaving}`}
              data-kind={leaving}
              aria-hidden="true"
            >
              <span className={styles.card}>
                <CardFace kind={kindOf(leaving)} />
              </span>
            </div>
          ) : null}
          <button
            key={activeKey}
            type="button"
            className={`${styles.cardWrap} ${styles.flyIn} ${
              selected === activeKey ? styles.glow : ""
            }`}
            data-kind={activeKey}
            onClick={select}
            aria-pressed={selected === activeKey}
            aria-label={`选择${active.label}`}
          >
            <span className={styles.halo} aria-hidden="true" />
            <span className={styles.card}>
              <CardFace kind={active} />
            </span>
          </button>
        </div>

        <button
          type="button"
          className={styles.deck}
          onClick={advance}
          aria-label="下一张"
          disabled={Boolean(leaving)}
        >
          {deck.slice(1).map((k, i) => (
            <span key={k} className={styles.deckCard} data-kind={k} data-i={i}>
              <CardFace kind={kindOf(k)} />
            </span>
          ))}
          <span className={styles.deckHint}>点击切换</span>
        </button>
      </div>

      <div className={styles.prompt}>
        {selected ? (
          <>
            <span>确认选择「{kindOf(selected).label}」吗？</span>
            <button type="button" className={styles.confirm} onClick={confirm}>
              确认
            </button>
            <button
              type="button"
              className={styles.cancel}
              onClick={() => setSelected(null)}
            >
              取消
            </button>
          </>
        ) : (
          <span className={styles.promptHint}>
            点击右侧牌堆切换，点击左侧卡片选择。
          </span>
        )}
      </div>
    </div>
  );
}
