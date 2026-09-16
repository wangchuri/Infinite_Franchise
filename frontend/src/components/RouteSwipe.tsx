"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import styles from "./route-swipe.module.css";

/**
 * Topbar order: 广场 (/), 发现世界 (/discover), 创作 (/create).
 * Moving down the order sweeps left → right; moving back sweeps right → left.
 * Any other in-app hop defaults to left → right.
 */
const GROUPS = ["/", "/discover", "/create"] as const;

type Dir = "ltr" | "rtl";
type Phase = "in" | "cover" | "out";
/** `sweep`: full ceremonial wipe (zone changes). `light`: quick cover + fade. */
type Mode = "sweep" | "light";

type Swipe = {
  dir: Dir;
  phase: Phase;
  mode: Mode;
  /** Full href to push (path + query + hash). */
  href: string;
  /** Normalized path we came from. */
  from: string;
  /** Normalized destination pathname (best guess for `back`). */
  to: string;
  /** Destination has no platform chrome, so the panel covers the whole screen. */
  full: boolean;
  /** Use history.back() instead of pushing `href`. */
  back: boolean;
};

function normalize(path: string): string {
  let p = path;
  try {
    p = decodeURIComponent(p);
  } catch {
    /* keep raw */
  }
  p = p.replace(/\/+$/, "");
  return p === "" ? "/" : p;
}

/** Which of the three top-level zones a path belongs to (or null). */
function zoneIndex(path: string): number | null {
  const p = normalize(path);
  const i = GROUPS.indexOf(p as (typeof GROUPS)[number]);
  return i === -1 ? null : i;
}

/** Both ends are different top-level zones (广场 / 发现世界 / 创作). */
function isZoneHop(from: string, to: string): boolean {
  const a = zoneIndex(from);
  const b = zoneIndex(to);
  return a !== null && b !== null && a !== b;
}

/** `to` is an ancestor section of `from` (returning up the hierarchy). */
function isAncestor(to: string, from: string): boolean {
  const t = normalize(to);
  const f = normalize(from);
  if (t === f) return false;
  if (t === "/") return true;
  return f.startsWith(`${t}/`);
}

/**
 * Direction: zone order wins, then returning to an ancestor reverses the
 * sweep, otherwise left → right.
 */
function directionFor(from: string, to: string, fallback: Dir = "ltr"): Dir {
  const a = zoneIndex(from);
  const b = zoneIndex(to);
  if (a !== null && b !== null && a !== b) return b! > a! ? "ltr" : "rtl";
  if (isAncestor(to, from)) return "rtl";
  return fallback;
}

function prefersReducedMotion(): boolean {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** The wiki surface renders standalone, so a panel over it spans the screen. */
function isChromeLess(path: string): boolean {
  return /^\/w\/[^/]+\/(?:wiki|entry|c)(?:\/|$)/.test(normalize(path));
}

/** Same-origin page links only — skip files, APIs, hashes and new tabs. */
function pageUrl(anchor: HTMLAnchorElement): URL | null {
  if (anchor.target && anchor.target !== "_self") return null;
  if (anchor.hasAttribute("download")) return null;
  let url: URL;
  try {
    url = new URL(anchor.href, window.location.href);
  } catch {
    return null;
  }
  if (url.origin !== window.location.origin) return null;
  if (url.pathname.startsWith("/api/")) return null;
  if (/\/[^/]*\.[a-z0-9]{1,5}$/i.test(url.pathname)) return null;
  return url;
}

/**
 * Skewed paper-sea panel for in-app navigation. Zone changes (广场 ↔ 发现世界
 * ↔ 创作) get the full ceremonial sweep; every other hop gets a quick cover +
 * cross-fade so it hides the load without dragging. Chrome-less destinations
 * (the wiki) are covered full-screen, chrome pages start under the topbar.
 *
 * While the destination is still loading the covered panel keeps looping a
 * shimmer; it only sweeps/fades away once the route has rendered.
 */
export default function RouteSwipe() {
  const pathname = usePathname();
  const router = useRouter();
  const [swipe, setSwipe] = useState<Swipe | null>(null);
  const active = useRef(false);
  const prevPath = useRef(pathname);
  /** Guards against pushing twice (e.g. Strict Mode double effects). */
  const pushGuard = useRef(false);

  useEffect(() => {
    prevPath.current = pathname;
  }, [pathname]);

  const current = normalize(pathname);
  // The destination rendered as soon as the path left `from` (a redirect
  // counts too, so `/me` → `/u/…` no longer gets stuck under the panel).
  const arrived = swipe ? current !== swipe.from : false;
  const phase: Phase | null = swipe
    ? swipe.phase === "cover" && arrived
      ? "out"
      : swipe.phase
    : null;
  const phaseRef = useRef<Phase | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  useEffect(() => {
    function start(href: string, from: string, to: string, back: boolean) {
      if (to === from) return;
      active.current = true;
      pushGuard.current = false;
      setSwipe({
        dir: directionFor(from, to),
        phase: "in",
        mode: isZoneHop(from, to) ? "sweep" : "light",
        href,
        from,
        to,
        full: isChromeLess(to),
        back,
      });
    }

    function onClick(e: MouseEvent) {
      if (active.current) return;
      if (e.defaultPrevented || e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      if (prefersReducedMotion()) return;

      const el = e.target as Element | null;
      const anchor = el?.closest?.("a");
      if (!anchor) return;
      const url = pageUrl(anchor);
      if (!url) return;

      const from = normalize(pathname);
      const to = normalize(url.pathname);
      if (to === from) return;

      // Capture phase: mark the event handled so <Link> skips its own push.
      e.preventDefault();
      start(url.pathname + url.search + url.hash, from, to, false);
    }

    function onCustom(e: Event) {
      const detail = (e as CustomEvent).detail as
        | { href?: string; back?: boolean; to?: string }
        | undefined;
      if (!detail?.href) return;
      if (prefersReducedMotion() || active.current) {
        if (detail.back) router.back();
        else router.push(detail.href);
        return;
      }
      const from = normalize(pathname);
      let to = detail.to ? normalize(detail.to) : "";
      if (!to) {
        try {
          to = normalize(new URL(detail.href, window.location.href).pathname);
        } catch {
          return;
        }
      }
      if (to === from) return;
      start(detail.href, from, to, detail.back === true);
    }

    function onPopState() {
      if (active.current || prefersReducedMotion()) return;
      const from = normalize(prevPath.current);
      const to = normalize(window.location.pathname);
      if (to === from) return;
      // The route already changed: start covered and sweep out to reveal it.
      active.current = true;
      pushGuard.current = true;
      setSwipe({
        dir: directionFor(from, to, "rtl"),
        phase: "cover",
        mode: isZoneHop(from, to) ? "sweep" : "light",
        href: window.location.pathname + window.location.search,
        from,
        to,
        full: isChromeLess(to),
        back: false,
      });
    }

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    window.addEventListener("if:navigate", onCustom as EventListener);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("if:navigate", onCustom as EventListener);
    };
  }, [pathname, router]);

  // Once the panel fully covers the viewport, swap the page underneath it.
  useEffect(() => {
    if (swipe?.phase !== "cover" || pushGuard.current) return;
    pushGuard.current = true;
    if (swipe.back) router.back();
    else router.push(swipe.href);
  }, [swipe, router]);

  // Safety net: never leave the panel stuck if an animation event is missed.
  // `cover` waits (looping) for the destination, so its fallback is generous.
  useEffect(() => {
    if (!phase) return;
    const ms = phase === "in" ? 700 : phase === "cover" ? 12000 : 900;
    const t = window.setTimeout(() => {
      if (phase === "in") {
        setSwipe((s) => (s && s.phase === "in" ? { ...s, phase: "cover" } : s));
      } else if (phase === "cover") {
        setSwipe((s) => (s && s.phase === "cover" ? { ...s, phase: "out" } : s));
      } else {
        active.current = false;
        setSwipe(null);
      }
    }, ms);
    return () => window.clearTimeout(t);
  }, [phase]);

  function onAnimationEnd() {
    if (phaseRef.current === "in") {
      setSwipe((s) => (s ? { ...s, phase: "cover" } : s));
    } else if (phaseRef.current === "out") {
      active.current = false;
      setSwipe(null);
    }
  }

  if (!swipe || !phase) return null;

  const cls =
    phase === "cover"
      ? styles.cover
      : phase === "in"
        ? swipe.mode === "light"
          ? swipe.dir === "ltr"
            ? styles.lightInLtr
            : styles.lightInRtl
          : swipe.dir === "ltr"
            ? styles.inLtr
            : styles.inRtl
        : swipe.mode === "light"
          ? styles.lightOut
          : swipe.dir === "ltr"
            ? styles.outLtr
            : styles.outRtl;

  return (
    <div
      className={`${styles.layer} ${swipe.full ? styles.layerFull : ""}`}
      aria-hidden="true"
    >
      <div className={`${styles.block} ${cls}`} onAnimationEnd={onAnimationEnd} />
    </div>
  );
}
