"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Workbench from "@/components/work/Workbench";
import { WORK_KINDS, type WorkCategory } from "@/lib/work-taxonomy";
import styles from "@/components/work/workbench.module.css";

const CATEGORIES = new Set(["novel", "artwork", "program", "audio", "video"]);

export default function CreateWorkbenchPage() {
  return (
    <Suspense fallback={<p className={styles.loading}>加载工作台…</p>}>
      <CreateWorkbench />
    </Suspense>
  );
}

function CreateWorkbench() {
  const params = useParams<{ type: string }>();
  const searchParams = useSearchParams();
  const type = params?.type ?? "";
  const category = (CATEGORIES.has(type) ? type : "other") as WorkCategory;

  const rawKind = searchParams.get("kind") ?? "";
  const kind = (WORK_KINDS[category] ?? []).some((k) => k.key === rawKind)
    ? rawKind
    : "";

  return (
    <Workbench
      initialCategory={category}
      prefill={{
        kind,
        title: searchParams.get("title") ?? "",
        summary: searchParams.get("summary") ?? "",
        mediaUrl: searchParams.get("cover"),
      }}
    />
  );
}
