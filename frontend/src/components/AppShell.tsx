"use client";

import Link from "next/link";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  clearTokens,
  fetchMe,
  getAccessToken,
  type AuthUser,
} from "@/lib/auth";
import TopSearch from "./TopSearch";
import styles from "./shell.module.css";

function initials(name: string): string {
  const t = name.trim();
  if (!t) return "?";
  return t.slice(0, 1).toUpperCase();
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);
  /** Avoid SSR/client nav mismatch (localStorage auth only exists in browser). */
  const [mounted, setMounted] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;
    let cancelled = false;
    async function load() {
      if (!getAccessToken()) {
        if (!cancelled) {
          setUser(null);
          setReady(true);
        }
        return;
      }
      try {
        const me = await fetchMe();
        if (!cancelled) setUser(me);
      } catch {
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setReady(true);
      }
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, [pathname, mounted]);

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;
    function onDocClick(e: MouseEvent) {
      if (!menuRef.current?.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function logout() {
    clearTokens();
    setUser(null);
    setMenuOpen(false);
    router.push("/login");
  }

  return (
    <div
      className={
        pathname === "/" ? `${styles.shell} ${styles.shellPlaza}` : styles.shell
      }
    >
      <header className={styles.topbar}>
        <Link href="/" className={styles.brand}>
          无限企划 <span>Infinite Franchise</span>
        </Link>
        <Suspense fallback={<span className={styles.topSearchSlot} />}>
          <TopSearch />
        </Suspense>
        <nav className={styles.nav}>
          <Link
            href="/"
            className={pathname === "/" ? styles.navActive : undefined}
          >
            广场
          </Link>
          <Link
            href="/discover"
            className={
              pathname.startsWith("/discover") ? styles.navActive : undefined
            }
          >
            发现世界
          </Link>
          {!mounted || !ready ? (
            <span className={styles.navSlot} aria-hidden="true" />
          ) : user ? (
            <>
              <Link
                href="/create"
                className={
                  pathname.startsWith("/create") ? styles.navActive : undefined
                }
              >
                创作
              </Link>
              <Link href="/worlds" className={styles.create}>
                创建世界观
              </Link>
              <div className={styles.avatarWrap} ref={menuRef}>
                <button
                  type="button"
                  className={styles.avatarBtn}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  aria-label="用户菜单"
                  onClick={() => setMenuOpen((v) => !v)}
                >
                  {user.avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={user.avatarUrl}
                      alt=""
                      className={styles.avatarImg}
                    />
                  ) : (
                    <span className={styles.avatarFallback}>
                      {initials(user.displayName || user.username)}
                    </span>
                  )}
                </button>
                {menuOpen ? (
                  <div className={styles.menu} role="menu">
                    <div className={styles.menuMeta}>
                      <strong>{user.displayName}</strong>
                      <span>@{user.username}</span>
                    </div>
                    <button
                      type="button"
                      role="menuitem"
                      className={styles.menuItem}
                      onClick={logout}
                    >
                      登出账号
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <Link href="/login">登录</Link>
              <Link href="/register">注册</Link>
            </>
          )}
        </nav>
      </header>
      <div
        className={
          pathname === "/"
            ? `${styles.main} ${styles.mainPlaza}`
            : pathname.startsWith("/works/")
              ? `${styles.main} ${styles.mainReader}`
              : styles.main
        }
      >
        {children}
      </div>
      <footer className={styles.footer}>无限企划 · Web · 本地开发</footer>
    </div>
  );
}
