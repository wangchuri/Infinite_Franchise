/**
 * Page-level custom CSS for the Wiki. Sanitized on the backend before storage
 * and scoped to the page root on render.
 *
 * Mirrors backend/src/config/page-css.ts — keep the two files in sync.
 */

export const MAX_PAGE_CSS = 60000;

/** Root id every Wiki page container uses; page CSS is scoped to it. */
export const PAGE_ROOT_ID = "wiki-root";

/**
 * Strip anything that could break out of the page's `<style>` element or load
 * external/active content. Authors keep full normal CSS.
 */
export function sanitizePageCss(raw: unknown): string {
  if (typeof raw !== "string") return "";
  let css = raw.slice(0, MAX_PAGE_CSS);

  // Never allow closing the style/script tag or raw markup.
  css = css.replace(/<\s*\/?\s*(?:style|script)\b[^>]*>/gi, "");
  css = css.replace(/</g, "");

  // No external imports, IE expressions or XBL bindings.
  css = css.replace(/@import\b[^;]*;?/gi, "");
  css = css.replace(/expression\s*\(/gi, "");
  css = css.replace(/-moz-binding\s*:/gi, "");

  // No javascript: URLs.
  css = css.replace(
    /url\s*\(\s*(['"]?)\s*javascript:[^)]*\)/gi,
    "none",
  );

  // Authors must not re-scope (would escape the page root).
  css = css.replace(/@scope\b/gi, "");

  return css.trim();
}

/** Wrap page CSS in `@scope (#root)` so it cannot leak to the platform UI. */
export function scopePageCss(
  css: string,
  rootId: string = PAGE_ROOT_ID,
): string {
  const clean = sanitizePageCss(css);
  if (!clean) return "";
  return `@scope (#${rootId}) {\n${clean}\n}`;
}
