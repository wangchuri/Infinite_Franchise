"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { fetchMe, getAccessToken } from "@/lib/auth";
import styles from "./me.module.css";

/** 「我」 opens my own public profile. */
export default function MeRedirect() {
  const router = useRouter();

  useEffect(() => {
    if (!getAccessToken()) {
      router.replace("/login");
      return;
    }
    let cancelled = false;
    fetchMe()
      .then((u) => {
        if (!cancelled) router.replace(`/u/${u.username}`);
      })
      .catch(() => {
        if (!cancelled) router.replace("/login");
      });
    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className={styles.page}>
      <p className={styles.muted}>正在打开你的主页…</p>
    </div>
  );
}
