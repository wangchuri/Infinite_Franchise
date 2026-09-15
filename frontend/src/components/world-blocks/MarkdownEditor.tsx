"use client";

import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import type { WorldCollection } from "@/lib/collections";
import type { WikiEntry } from "@/lib/worlds";
import styles from "./block-fields.module.css";

type Match = { entry: WikiEntry; typed: string; start: number };

type Hint = {
  entry: WikiEntry;
  typed: string;
  start: number;
  top: number;
  left: number;
  below: boolean;
};

const MIRROR_PROPS = [
  "boxSizing",
  "paddingTop",
  "paddingRight",
  "paddingBottom",
  "paddingLeft",
  "borderTopWidth",
  "borderRightWidth",
  "borderBottomWidth",
  "borderLeftWidth",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "fontStyle",
  "letterSpacing",
  "lineHeight",
  "textTransform",
  "wordSpacing",
  "textIndent",
  "tabSize",
] as const;

/** Caret offset (content box) of a textarea, measured with a hidden mirror. */
function caretCoords(
  el: HTMLTextAreaElement,
  pos: number,
): { top: number; left: number; lineHeight: number } {
  const cs = window.getComputedStyle(el);
  const div = document.createElement("div");
  for (const p of MIRROR_PROPS) div.style.setProperty(p, cs.getPropertyValue(p));
  div.style.position = "absolute";
  div.style.top = "0";
  div.style.left = "0";
  div.style.visibility = "hidden";
  div.style.pointerEvents = "none";
  div.style.width = cs.width;
  div.style.whiteSpace = "pre-wrap";
  div.style.overflowWrap = "break-word";
  div.style.wordWrap = "break-word";
  div.textContent = el.value.slice(0, pos);
  const marker = document.createElement("span");
  marker.textContent = "\u200b";
  div.appendChild(marker);
  document.body.appendChild(div);
  const top = marker.offsetTop;
  const left = marker.offsetLeft;
  document.body.removeChild(div);
  const lh = parseFloat(cs.lineHeight);
  return { top, left, lineHeight: Number.isFinite(lh) ? lh : 20 };
}

/** Markdown textarea with `[[词条名]]` autocomplete and inline entry hints. */
export default function MarkdownEditor({
  value,
  onChange,
  entries,
  collections,
  placeholder,
  rows = 10,
  className,
  wrapClassName,
  menuVariant = "below",
}: {
  value: string;
  onChange: (value: string) => void;
  entries: WikiEntry[];
  collections: WorldCollection[];
  placeholder?: string;
  rows?: number;
  /** Class for the textarea itself. */
  className?: string;
  /** Class for the relative wrapper that anchors the suggestion menu. */
  wrapClassName?: string;
  /** Anchor the menu right under the field, or at the bottom of the box. */
  menuVariant?: "below" | "bottom";
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [query, setQuery] = useState<string | null>(null);
  const [active, setActive] = useState(0);
  const [hint, setHint] = useState<Hint | null>(null);
  const [suppressed, setSuppressed] = useState<string | null>(null);

  /** Titles + aliases, longest first, so the longest match wins. */
  const names = useMemo(() => {
    const list: { name: string; entry: WikiEntry }[] = [];
    for (const e of entries) {
      if (e.title.length >= 2) list.push({ name: e.title, entry: e });
      for (const a of e.aliases ?? []) {
        if (a.length >= 2) list.push({ name: a, entry: e });
      }
    }
    list.sort((a, b) => b.name.length - a.name.length);
    return list;
  }, [entries]);

  const groups = useMemo(() => {
    if (query === null) return [];
    const byCat = new Map<string, WikiEntry[]>();
    for (const e of entries) {
      if (query && !e.title.includes(query) && !e.slug.includes(query)) continue;
      const arr = byCat.get(e.category);
      if (arr) arr.push(e);
      else byCat.set(e.category, [e]);
    }
    const ordered: { key: string; name: string; items: WikiEntry[] }[] = [];
    for (const c of collections) {
      const items = byCat.get(c.key);
      if (items && items.length) {
        ordered.push({ key: c.key, name: c.name, items });
      }
      byCat.delete(c.key);
    }
    for (const [key, items] of byCat) ordered.push({ key, name: key, items });
    return ordered;
  }, [entries, collections, query]);

  const flat = useMemo(
    () => groups.flatMap((g) => g.items).slice(0, 40),
    [groups],
  );

  const activeIndex = flat.length ? Math.min(active, flat.length - 1) : 0;

  /** Does the text just before the caret end with a known entry name? */
  function findMatch(before: string): Match | null {
    if (!before) return null;
    for (const { name, entry } of names) {
      if (!before.endsWith(name)) continue;
      const start = before.length - name.length;
      if (before.slice(Math.max(0, start - 2), start) === "[[") continue;
      const prev = start > 0 ? before[start - 1] : "";
      if (prev && /[A-Za-z0-9_]/.test(prev) && /^[A-Za-z0-9_]/.test(name)) {
        continue;
      }
      return { entry, typed: name, start };
    }
    return null;
  }

  function refresh(el: HTMLTextAreaElement) {
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const m = /\[\[([^[\]]*)$/.exec(before);
    const q = m ? m[1] : null;
    if (q !== query) {
      setQuery(q);
      setActive(0);
    }
    if (q !== null) {
      setHint(null);
      return;
    }
    const found = findMatch(before);
    if (!found || suppressed === found.typed) {
      setHint(null);
      return;
    }
    const c = caretCoords(el, pos);
    const top = c.top - el.scrollTop;
    const below = top < 34;
    setHint({
      entry: found.entry,
      typed: found.typed,
      start: found.start,
      top: below ? top + c.lineHeight + 6 : top - 32,
      left: c.left,
      below,
    });
  }

  function insert(title: string) {
    const el = ref.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const before = el.value.slice(0, pos);
    const start = before.lastIndexOf("[[");
    if (start < 0) return;
    const next =
      before.slice(0, start) + `[[${title}]]` + el.value.slice(pos);
    onChange(next);
    setQuery(null);
    const caret = start + title.length + 4;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  /** Wrap the matched name into a `[[词条名]]` reference. */
  function applyHint() {
    const el = ref.current;
    if (!el || !hint) return;
    const pos = el.selectionStart ?? 0;
    const start = pos - hint.typed.length;
    if (start < 0) return;
    const link =
      hint.entry.title === hint.typed
        ? `[[${hint.entry.title}]]`
        : `[[${hint.entry.title}|${hint.typed}]]`;
    const next = el.value.slice(0, start) + link + el.value.slice(pos);
    onChange(next);
    setHint(null);
    const caret = start + link.length;
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(caret, caret);
    });
  }

  useEffect(() => {
    if (query === null) return;
    const el = ref.current?.parentElement?.querySelector<HTMLElement>(
      "[data-active='1']",
    );
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, query]);

  let running = -1;

  return (
    <div
      className={
        wrapClassName ? `${styles.mdWrap} ${wrapClassName}` : styles.mdWrap
      }
    >
      <textarea
        ref={ref}
        rows={rows}
        spellCheck={false}
        className={className}
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          setSuppressed(null);
          onChange(e.target.value);
          refresh(e.target);
        }}
        onClick={(e) => refresh(e.currentTarget)}
        onKeyUp={(e) => refresh(e.currentTarget)}
        onScroll={() => setHint(null)}
        onBlur={() => setHint(null)}
        onKeyDown={(e) => {
          if (hint && !suppressed) {
            if (e.key === "Tab") {
              e.preventDefault();
              applyHint();
              return;
            }
            if (e.key === "Escape") {
              e.preventDefault();
              setSuppressed(hint.typed);
              setHint(null);
              return;
            }
          }
          if (query === null || flat.length === 0) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (Math.min(a, flat.length - 1) + 1) % flat.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive(
              (a) =>
                (Math.min(a, flat.length - 1) - 1 + flat.length) % flat.length,
            );
          } else if (e.key === "Enter" || e.key === "Tab") {
            e.preventDefault();
            insert(flat[activeIndex].title);
          } else if (e.key === "Escape") {
            setQuery(null);
          }
        }}
      />
      {hint ? (
        <button
          type="button"
          className={styles.mdChip}
          style={{ top: hint.top, left: hint.left }}
          title="标记为词条引用"
          onMouseDown={(ev) => {
            ev.preventDefault();
            applyHint();
          }}
        >
          标记「{hint.entry.title}」
          <span className={styles.mdChipKey}>Tab</span>
        </button>
      ) : null}
      {query !== null && flat.length > 0 ? (
        <ul
          className={
            menuVariant === "bottom" ? styles.mdMenuBottom : styles.mdMenu
          }
        >
          {groups.map((g) => (
            <Fragment key={g.key}>
              <li className={styles.mdGroup}>{g.name}</li>
              {g.items.map((e) => {
                running += 1;
                const idx = running;
                if (idx >= flat.length) return null;
                return (
                  <li key={e.id}>
                    <button
                      type="button"
                      data-active={idx === activeIndex ? "1" : undefined}
                      className={
                        idx === activeIndex ? styles.mdItemOn : styles.mdItem
                      }
                      onMouseDown={(ev) => {
                        ev.preventDefault();
                        insert(e.title);
                      }}
                      onMouseEnter={() => setActive(idx)}
                    >
                      {e.title}
                    </button>
                  </li>
                );
              })}
            </Fragment>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
