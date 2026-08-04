"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import styles from "./shell.module.css";

/** Topbar search: plaza → 搜索广场; discover → 搜索世界. */
export default function TopSearch() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [value, setValue] = useState("");

  const onPlaza = pathname === "/";
  const onDiscover = pathname.startsWith("/discover");
  const visible = onPlaza || onDiscover;

  useEffect(() => {
    if (!visible) return;
    setValue(searchParams.get("q") ?? "");
  }, [searchParams, visible, pathname]);

  if (!visible) return null;

  function commit(next: string) {
    setValue(next);
    const params = new URLSearchParams(searchParams.toString());
    const trimmed = next.trim();
    if (trimmed) params.set("q", trimmed);
    else params.delete("q");
    const qs = params.toString();
    router.replace(`${pathname}${qs ? `?${qs}` : ""}`, { scroll: false });
  }

  return (
    <label className={styles.topSearch}>
      <span className={styles.srOnly}>搜索</span>
      <input
        type="search"
        value={value}
        onChange={(e) => commit(e.target.value)}
        placeholder={onPlaza ? "搜索广场" : "搜索世界"}
        autoComplete="off"
      />
    </label>
  );
}
