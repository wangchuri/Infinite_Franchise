"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** Legacy path: always go through the worlds hub. */
export default function NewWorldRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/worlds");
  }, [router]);

  return (
    <p style={{ color: "var(--ink-soft)", padding: "2rem 0" }}>
      正在前往我的世界观…
    </p>
  );
}
