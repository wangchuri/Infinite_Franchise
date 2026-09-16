"use client";

import { useEffect, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";

export type TrailEntry = {
  href: string;
  label: string;
};

/**
 * In-app navigation trail. AppShell records every visited path; pages refine
 * the label of their own entry (world name, work title, ...). The back button
 * reads the previous entry.
 */
let entries: TrailEntry[] = [];
const listeners = new Set<() => void>();

function emit(): void {
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): TrailEntry[] {
  return entries;
}

const EMPTY: TrailEntry[] = [];
function getServerSnapshot(): TrailEntry[] {
  return EMPTY;
}

/** Record a visit; revisit of an earlier href is treated as going back. */
export function recordVisit(href: string, label: string): void {
  const last = entries[entries.length - 1];
  if (last?.href === href) {
    if (label && last.label !== label) {
      entries = [...entries.slice(0, -1), { href, label }];
      emit();
    }
    return;
  }
  const idx = entries.findIndex((e) => e.href === href);
  if (idx >= 0) {
    entries = [
      ...entries.slice(0, idx),
      { href, label: label || entries[idx].label },
    ];
  } else {
    entries = [...entries, { href, label }];
  }
  emit();
}

/** Refine the label of an already-recorded entry. */
export function setLabelFor(href: string, label: string): void {
  const idx = entries.findIndex((e) => e.href === href);
  if (idx < 0) {
    recordVisit(href, label);
    return;
  }
  if (entries[idx].label === label) return;
  const next = entries.slice();
  next[idx] = { href, label };
  entries = next;
  emit();
}

export function useNavTrail(): TrailEntry[] {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

/** Pages call this so the trail shows a human name for this route. */
export function usePageLabel(label?: string | null): void {
  const pathname = usePathname();
  useEffect(() => {
    if (label) setLabelFor(pathname, label);
  }, [pathname, label]);
}

/** Structure-only fallback label, used before a page refines it. */
export function defaultLabel(pathname: string): string {
  if (pathname === "/") return "广场";
  if (pathname.startsWith("/discover")) return "世界";
  if (/^\/create\/lab/.test(pathname)) return "创作实验室";
  if (/^\/create\//.test(pathname)) return "创作";
  if (pathname.startsWith("/create")) return "创作";
  if (/^\/works\/[^/]+\/edit/.test(pathname)) return "编辑作品";
  if (pathname.startsWith("/works/")) return "作品";
  if (/^\/w\/[^/]+\/discussion/.test(pathname)) return "讨论";
  if (/^\/w\/[^/]+\/wiki/.test(pathname)) return "Wiki";
  if (/^\/w\/[^/]+\/entry/.test(pathname)) return "词条";
  if (/^\/w\/[^/]+\/c\//.test(pathname)) return "词条集";
  if (/^\/w\/[^/]+/.test(pathname)) return "世界";
  if (pathname.startsWith("/worlds/new")) return "创建世界观";
  if (/^\/worlds\/[^/]+\/edit/.test(pathname)) return "编辑世界观";
  if (/^\/worlds\/[^/]+\/wiki/.test(pathname)) return "Wiki 界面";
  if (/^\/worlds\/[^/]+\/entries/.test(pathname)) return "词条库";
  if (pathname.startsWith("/worlds")) return "我的世界观";
  if (pathname.startsWith("/u/")) return "个人主页";
  if (pathname.startsWith("/me/edit")) return "编辑资料";
  if (pathname.startsWith("/me")) return "我";
  if (pathname.startsWith("/login")) return "登录";
  if (pathname.startsWith("/register")) return "注册";
  return "返回";
}

/** Where to go when there is no in-app history (deep link / new tab). */
export function parentHref(pathname: string): string {
  const worldSlug = pathname.split("/")[2] ?? "";
  if (/^\/w\/[^/]+\//.test(pathname)) return `/w/${worldSlug}`;
  if (/^\/w\/[^/]+/.test(pathname)) return "/discover";
  if (pathname.startsWith("/works/")) return "/";
  if (pathname.startsWith("/create/")) return "/create";
  if (pathname.startsWith("/worlds/")) return "/worlds";
  if (pathname.startsWith("/u/")) return "/";
  if (pathname.startsWith("/me/")) return "/me";
  return "/";
}
