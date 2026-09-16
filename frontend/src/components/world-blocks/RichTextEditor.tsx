"use client";

import { useEffect, useRef, useState } from "react";
import { sanitizeRichHtml } from "@/lib/rich-html";
import { uploadImage } from "@/lib/worlds";
import styles from "./rich-text-editor.module.css";

type Props = {
  value: string;
  onChange: (html: string) => void;
  placeholder?: string;
  onError?: (message: string) => void;
};

/** WYSIWYG rich text with an HTML source mode. Emits sanitized HTML. */
export default function RichTextEditor({
  value,
  onChange,
  placeholder,
  onError,
}: Props) {
  const [mode, setMode] = useState<"wysiwyg" | "html">("wysiwyg");
  const ref = useRef<HTMLDivElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Keep the editable in sync with external value changes, but never while the
  // author is typing (would reset the caret).
  useEffect(() => {
    if (mode !== "wysiwyg") return;
    const el = ref.current;
    if (!el) return;
    if (document.activeElement === el) return;
    const clean = sanitizeRichHtml(value || "");
    if (el.innerHTML !== clean) el.innerHTML = clean;
  }, [value, mode]);

  function emit() {
    const el = ref.current;
    if (el) onChange(el.innerHTML);
  }

  function exec(command: string, arg?: string) {
    ref.current?.focus();
    document.execCommand(command, false, arg);
    emit();
  }

  async function insertImage(file: File | undefined) {
    if (!file) return;
    try {
      const url = await uploadImage(file);
      exec("insertHTML", `<img src="${url}" alt="" />`);
    } catch (err) {
      onError?.(err instanceof Error ? err.message : "上传失败");
    }
  }

  function addLink() {
    const url = window.prompt("链接地址（https://…）");
    if (!url) return;
    exec("createLink", url);
  }

  function pickImage() {
    fileRef.current?.click();
  }

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        {mode === "wysiwyg" ? (
          <>
            <button
              type="button"
              title="加粗"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("bold")}
            >
              B
            </button>
            <button
              type="button"
              title="斜体"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("italic")}
            >
              I
            </button>
            <button
              type="button"
              title="下划线"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("underline")}
            >
              U
            </button>
            <button
              type="button"
              title="二级标题"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("formatBlock", "H2")}
            >
              H2
            </button>
            <button
              type="button"
              title="三级标题"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("formatBlock", "H3")}
            >
              H3
            </button>
            <button
              type="button"
              title="无序列表"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("insertUnorderedList")}
            >
              •
            </button>
            <button
              type="button"
              title="有序列表"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("insertOrderedList")}
            >
              1.
            </button>
            <button
              type="button"
              title="引用"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("formatBlock", "BLOCKQUOTE")}
            >
              ❝
            </button>
            <button
              type="button"
              title="链接"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={addLink}
            >
              🔗
            </button>
            <button
              type="button"
              title="插入图片"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={pickImage}
            >
              🖼
            </button>
            <button
              type="button"
              title="清除格式"
              className={styles.tool}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => exec("removeFormat")}
            >
              ⌫
            </button>
          </>
        ) : null}
        <button
          type="button"
          className={styles.mode}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() =>
            setMode((m) => (m === "wysiwyg" ? "html" : "wysiwyg"))
          }
        >
          {mode === "wysiwyg" ? "HTML 源码" : "返回编辑"}
        </button>
      </div>

      {mode === "wysiwyg" ? (
        <div
          ref={ref}
          className={styles.canvas}
          contentEditable
          suppressContentEditableWarning
          data-placeholder={placeholder ?? "在这里写内容…"}
          onInput={emit}
          onBlur={emit}
        />
      ) : (
        <textarea
          className={styles.source}
          value={value}
          spellCheck={false}
          onChange={(e) => onChange(e.target.value)}
          onBlur={(e) => onChange(sanitizeRichHtml(e.target.value))}
        />
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        hidden
        onChange={(e) => {
          void insertImage(e.target.files?.[0]);
          e.target.value = "";
        }}
      />
    </div>
  );
}
