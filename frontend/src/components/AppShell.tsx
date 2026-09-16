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
import RouteSwipe from "./RouteSwipe";
import {
  defaultLabel,
  parentHref,
  recordVisit,
  useNavTrail,
} from "@/lib/nav-trail";
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
  const topbarRef = useRef<HTMLElement>(null);
  const trail = useNavTrail();

  useEffect(() => {
    setMounted(true);
  }, []);

  // Remember where the user has been so the header can offer a named back link.
  useEffect(() => {
    recordVisit(pathname, defaultLabel(pathname));
  }, [pathname]);

  // Expose the real topbar height so sticky world headers can offset correctly.
  useEffect(() => {
    const el = topbarRef.current;
    if (!el) return;
    const update = () => {
      document.documentElement.style.setProperty(
        "--topbar-h",
        `${el.offsetHeight}px`,
      );
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, [mounted, pathname]);

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

  /** Reveal scrollbars only while a container is actively scrolling. */
  useEffect(() => {
    const timers = new WeakMap<Element, number>();
    function onScroll(e: Event) {
      const target = e.target;
      const el =
        target instanceof Document
          ? target.scrollingElement
          : target instanceof HTMLElement
            ? target
            : null;
      if (!el || !el.classList) return;

      el.classList.add("is-scrolling");
      const prev = timers.get(el);
      if (prev) window.clearTimeout(prev);
      timers.set(
        el,
        window.setTimeout(() => {
          el.classList.remove("is-scrolling");
          timers.delete(el);
        }, 700),
      );
    }
    document.addEventListener("scroll", onScroll, true);
    return () => document.removeEventListener("scroll", onScroll, true);
  }, []);

  function logout() {
    clearTokens();
    setUser(null);
    setMenuOpen(false);
    router.push("/login");
  }

  const isLab = pathname.startsWith("/create/lab");
  /**
   * The wiki surface (author layout, public collection + entry pages) renders
   * its own standalone shell with no platform chrome. The world home and
   * discussion keep the platform topbar.
   */
  const isWorldWiki =
    /^\/w\/[^/]+\/(?:wiki|entry|c)(?:\/|$)/.test(pathname);
  const isWorld = pathname.startsWith("/w/");
  /** World home locks the viewport: only the works column scrolls. */
  const isWorldHome = /^\/w\/[^/]+\/?$/.test(pathname);
  /** Visual wiki layout editor / entry library fill the viewport like tools. */
  const isWikiLayoutEditor =
    /^\/worlds\/[^/]+\/(?:wiki|entries)(?:\/|$)/.test(pathname);
  /** The workbench for a creative type fills the viewport like a tool. */
  const isCreateWorkbench =
    /^\/create\/(?:novel|artwork|program|audio|video)(?:\/|$)/.test(pathname);
  /** Editing a work fills the viewport like a tool. */
  const isWorkBench = /^\/works\/[^/]+\/edit(?:\/|$)/.test(pathname);

  /** Routes already covered by the top nav need no back link. */
  const isNavRoot =
    pathname === "/" ||
    pathname === "/discover" ||
    pathname === "/create" ||
    pathname === "/me";
  const prevEntry = trail.length >= 2 ? trail[trail.length - 2] : null;
  const backHref = prevEntry ? prevEntry.href : parentHref(pathname);
  const backLabel = prevEntry
    ? prevEntry.label || defaultLabel(prevEntry.href)
    : defaultLabel(parentHref(pathname));
  const showBack = !isWorldWiki && !isNavRoot;

  function goBack() {
    // Route through the swipe layer so the back button animates too.
    window.dispatchEvent(
      new CustomEvent("if:navigate", {
        detail: {
          href: backHref,
          to: prevEntry ? prevEntry.href : undefined,
          back: Boolean(prevEntry),
        },
      }),
    );
  }

  if (isWorldWiki) {
    return <>{children}</>;
  }

  return (
    <div
      className={[
        styles.shell,
        pathname === "/" ? styles.shellPlaza : "",
        isLab ? styles.shellLab : "",
        isWorldHome || isWikiLayoutEditor || isCreateWorkbench || isWorkBench
          ? styles.shellWorld
          : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <header className={styles.topbar} ref={topbarRef}>
        <div className={styles.brandRow}>
          <Link href="/" className={styles.brand}>
            无限企划 <span>Infinite Franchise</span>
          </Link>
          {showBack ? (
            <button
              type="button"
              className={styles.backBtn}
              onClick={goBack}
              title={`返回${backLabel}`}
            >
              <span className={styles.backArrow} aria-hidden="true">
                ←
              </span>
              <span className={styles.backLabel}>{backLabel}</span>
            </button>
          ) : null}
        </div>
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
            世界
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
              <Link
                href={`/u/${user.username}`}
                className={
                  pathname.startsWith("/me") ||
                  pathname.startsWith(`/u/${user.username}`)
                    ? styles.navActive
                    : undefined
                }
              >
                我
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
                    <Link
                      href={`/u/${user.username}`}
                      className={styles.menuLink}
                      role="menuitem"
                    >
                      个人主页
                    </Link>
                    <Link
                      href="/me/edit"
                      className={styles.menuLink}
                      role="menuitem"
                    >
                      编辑资料
                    </Link>
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
            : pathname.startsWith("/works/") && !isWorkBench
              ? `${styles.main} ${styles.mainReader}`
              : isWorld || isWikiLayoutEditor || isCreateWorkbench || isWorkBench
                ? `${styles.main} ${styles.mainWorld}`
                : styles.main
        }
      >
        {children}
      </div>
      <RouteSwipe />
    </div>
  );
}
