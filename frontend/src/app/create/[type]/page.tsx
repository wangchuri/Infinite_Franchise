"use client";

import Link from "next/link";
import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { getAccessToken } from "@/lib/auth";
import styles from "../create.module.css";

const LABELS: Record<string, string> = {
  novel: "小说",
  artwork: "美术",
  program: "程序",
  audio: "音频",
  world: "世界观",
};

export default function CreateTypePage() {
  const router = useRouter();
  const params = useParams<{ type: string }>();
  const type = params?.type ?? "";
  const label = LABELS[type] ?? "创作";

  useEffect(() => {
    if (!getAccessToken()) router.replace("/login");
  }, [router]);

  return (
    <div className={styles.stage}>
      <header className={styles.head}>
        <p className={styles.eyebrow}>Create · {type}</p>
        <h1 className={styles.title}>{label}</h1>
        <p className={styles.lead}>创作界面待设计。</p>
      </header>
      <Link className={styles.back} href="/create">
        ← 返回选择
      </Link>
    </div>
  );
}
