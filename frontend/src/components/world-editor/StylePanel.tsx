"use client";

import { useEffect, useState } from "react";
import {
  HERO_LABELS,
  LAYOUT_LABELS,
  MODULE_LABELS,
  THEME_LABELS,
  WIKI_HERO_STYLES,
  WIKI_LAYOUTS,
  WIKI_MODULES,
  WIKI_THEMES,
  type HomepageConfig,
  type WikiModule,
} from "@/lib/homepage-config";
import styles from "./StylePanel.module.css";

type Props = {
  value: HomepageConfig;
  onChange: (next: HomepageConfig) => void;
};

export default function StylePanel({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [accentDraft, setAccentDraft] = useState(value.accent);

  useEffect(() => {
    setAccentDraft(value.accent);
  }, [value.accent]);

  function patch(partial: Partial<HomepageConfig>) {
    onChange({ ...value, ...partial });
  }

  function toggleModule(mod: WikiModule) {
    const has = value.modules.includes(mod);
    if (has) {
      if (value.modules.length <= 1) return;
      patch({ modules: value.modules.filter((m) => m !== mod) });
    } else {
      const order = WIKI_MODULES.filter(
        (m) => m === mod || value.modules.includes(m),
      );
      patch({ modules: order });
    }
  }

  function moveModule(mod: WikiModule, dir: -1 | 1) {
    const idx = value.modules.indexOf(mod);
    if (idx < 0) return;
    const next = [...value.modules];
    const j = idx + dir;
    if (j < 0 || j >= next.length) return;
    [next[idx], next[j]] = [next[j], next[idx]];
    patch({ modules: next });
  }

  return (
    <div className={styles.panel}>
      <button
        type="button"
        className={styles.toggle}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className={styles.heading}>Wiki 样式</span>
        <span className={styles.toggleHint}>
          {open ? "收起" : "展开设置"}
        </span>
      </button>

      {open ? (
        <div className={styles.body}>
          <p className={styles.hint}>
            选择主题与布局，平台负责渲染。内容仍按模块展示，不开放任意 CSS。
          </p>

      <label className={styles.field}>
        <span>主题</span>
        <select
          value={value.theme}
          onChange={(e) =>
            patch({ theme: e.target.value as HomepageConfig["theme"] })
          }
        >
          {WIKI_THEMES.map((t) => (
            <option key={t} value={t}>
              {THEME_LABELS[t]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>布局</span>
        <select
          value={value.layout}
          onChange={(e) =>
            patch({ layout: e.target.value as HomepageConfig["layout"] })
          }
        >
          {WIKI_LAYOUTS.map((l) => (
            <option key={l} value={l}>
              {LAYOUT_LABELS[l]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>头图样式</span>
        <select
          value={value.heroStyle}
          onChange={(e) =>
            patch({
              heroStyle: e.target.value as HomepageConfig["heroStyle"],
            })
          }
        >
          {WIKI_HERO_STYLES.map((h) => (
            <option key={h} value={h}>
              {HERO_LABELS[h]}
            </option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span>强调色（可选，#RRGGBB）</span>
        <div className={styles.accentRow}>
          <input
            type="color"
            value={
              /^#[0-9A-Fa-f]{6}$/.test(value.accent) ? value.accent : "#1f5c5a"
            }
            onChange={(e) => {
              setAccentDraft(e.target.value);
              patch({ accent: e.target.value });
            }}
            aria-label="强调色"
          />
          <input
            type="text"
            value={accentDraft}
            placeholder="留空用主题默认"
            maxLength={7}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === "" || /^#[0-9A-Fa-f]{0,6}$/.test(v)) {
                setAccentDraft(v);
              }
            }}
            onBlur={() => {
              if (accentDraft === "" || /^#[0-9A-Fa-f]{6}$/.test(accentDraft)) {
                patch({ accent: accentDraft });
              } else {
                setAccentDraft(value.accent);
              }
            }}
          />
          {value.accent ? (
            <button
              type="button"
              onClick={() => {
                setAccentDraft("");
                patch({ accent: "" });
              }}
            >
              清除
            </button>
          ) : null}
        </div>
      </label>

      <label className={styles.check}>
        <input
          type="checkbox"
          checked={value.showTags}
          onChange={(e) => patch({ showTags: e.target.checked })}
        />
        显示标签
      </label>

      <div className={styles.modules}>
        <span className={styles.modulesLabel}>模块与顺序</span>
        <ul>
          {WIKI_MODULES.map((mod) => {
            const on = value.modules.includes(mod);
            const orderIdx = value.modules.indexOf(mod);
            return (
              <li key={mod}>
                <label>
                  <input
                    type="checkbox"
                    checked={on}
                    onChange={() => toggleModule(mod)}
                  />
                  {MODULE_LABELS[mod]}
                </label>
                {on ? (
                  <span className={styles.move}>
                    <button
                      type="button"
                      disabled={orderIdx <= 0}
                      onClick={() => moveModule(mod, -1)}
                      aria-label="上移"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={orderIdx >= value.modules.length - 1}
                      onClick={() => moveModule(mod, 1)}
                      aria-label="下移"
                    >
                      ↓
                    </button>
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
          </div>
        </div>
      ) : null}
    </div>
  );
}
