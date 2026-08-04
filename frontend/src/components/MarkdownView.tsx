"use client";

import ReactMarkdown from "react-markdown";
import styles from "./markdown.module.css";

export default function MarkdownView({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  if (!content.trim()) {
    return <p className={styles.empty}>暂无内容</p>;
  }
  return (
    <div className={className ? `${styles.md} ${className}` : styles.md}>
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  );
}
