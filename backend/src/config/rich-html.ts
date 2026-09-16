/**
 * Best-effort HTML sanitizer for author rich text (defense in depth).
 * The authoritative sanitize happens on render in the browser.
 *
 * Mirrors frontend/src/lib/rich-html.ts — keep in sync.
 */

const DANGEROUS_TAGS = [
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "form",
  "link",
  "meta",
  "base",
];

export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  let out = html;
  for (const tag of DANGEROUS_TAGS) {
    const paired = new RegExp(
      `<\\s*${tag}\\b[\\s\\S]*?<\\s*\\/\\s*${tag}\\s*>`,
      "gi",
    );
    const selfClosing = new RegExp(`<\\s*\\/?\\s*${tag}\\b[^>]*>`, "gi");
    out = out.replace(paired, "").replace(selfClosing, "");
  }
  out = out.replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "");
  out = out.replace(/javascript:/gi, "");
  return out;
}
