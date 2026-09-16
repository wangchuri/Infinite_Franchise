/**
 * Import/export for Wiki page layouts (Agent-friendly JSON).
 *
 * A single page file is `{ format, version, kind, collectionKey, title, slug,
 * css, layout }`; a bare WorldLayout object is also accepted on import. A world
 * file bundles every page.
 */
import { normalizeWorldLayout, type WorldLayout } from "./world-layout";
import type { WorldPage } from "./worlds";

export const PAGE_EXPORT_FORMAT = "infinite-franchise/wiki-page";
export const WORLD_EXPORT_FORMAT = "infinite-franchise/wiki-world";
export const PAGE_EXPORT_VERSION = 1;

export type PageExport = {
  format: string;
  version: number;
  kind: WorldPage["kind"];
  collectionKey: string | null;
  title: string;
  slug: string;
  css: string;
  layout: WorldLayout;
};

/** The parts of a page that matter for a file (a WorldPage fits this). */
export type PageLike = Omit<PageExport, "format" | "version">;

export function exportPageFile(page: PageLike): PageExport {
  return {
    format: PAGE_EXPORT_FORMAT,
    version: PAGE_EXPORT_VERSION,
    kind: page.kind,
    collectionKey: page.collectionKey,
    title: page.title,
    slug: page.slug,
    css: page.css,
    layout: normalizeWorldLayout(page.layout),
  };
}

export function exportWorldFile(pages: PageLike[]): {
  format: string;
  version: number;
  pages: PageExport[];
} {
  return {
    format: WORLD_EXPORT_FORMAT,
    version: PAGE_EXPORT_VERSION,
    pages: pages.map(exportPageFile),
  };
}

export type ImportedPage = {
  layout: WorldLayout;
  css: string;
  title?: string;
  slug?: string;
};

/** Parse an imported page JSON; accepts a wrapped file or a bare layout. */
export function parsePageImport(raw: string): ImportedPage {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error("JSON 解析失败");
  }
  if (!data || typeof data !== "object" || Array.isArray(data)) {
    throw new Error("不是有效的布局 JSON");
  }
  const src = data as Record<string, unknown>;
  const layoutSrc = src.layout ?? data;
  const layout = normalizeWorldLayout(layoutSrc);
  const css = typeof src.css === "string" ? src.css : "";
  const out: ImportedPage = { layout, css };
  if (typeof src.title === "string") out.title = src.title;
  if (typeof src.slug === "string") out.slug = src.slug;
  return out;
}

export function downloadJson(filename: string, data: unknown): void {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
