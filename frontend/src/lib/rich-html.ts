/**
 * Sanitizer for author rich-text HTML that is rendered inline (not sandboxed).
 *
 * Client-side (authoritative): parses the HTML and keeps only an allowlist of
 * tags/attributes. Server fallback: regex strip of dangerous constructs.
 *
 * Mirrors backend/src/config/rich-html.ts (regex best-effort) — keep in sync.
 */

const ALLOWED_TAGS = new Set([
  "p",
  "br",
  "hr",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "strong",
  "b",
  "em",
  "i",
  "u",
  "s",
  "del",
  "mark",
  "small",
  "sub",
  "sup",
  "blockquote",
  "ul",
  "ol",
  "li",
  "a",
  "img",
  "figure",
  "figcaption",
  "span",
  "div",
  "section",
  "code",
  "pre",
  "table",
  "thead",
  "tbody",
  "tr",
  "th",
  "td",
]);

const DANGEROUS = new Set([
  "script",
  "style",
  "iframe",
  "object",
  "embed",
  "link",
  "meta",
  "base",
  "form",
]);

const ALLOWED_ATTRS: Record<string, Set<string>> = {
  "*": new Set(["class"]),
  a: new Set(["href", "title", "target", "rel"]),
  img: new Set(["src", "alt", "title", "width", "height"]),
  td: new Set(["colspan", "rowspan"]),
  th: new Set(["colspan", "rowspan"]),
};

function safeUrl(value: string): boolean {
  const url = value.trim().toLowerCase();
  if (url.startsWith("#")) return true;
  if (url.startsWith("/") || url.startsWith("./") || url.startsWith("../")) {
    return true;
  }
  if (url.startsWith("http://") || url.startsWith("https://")) return true;
  if (url.startsWith("mailto:") || url.startsWith("tel:")) return true;
  if (url.startsWith("data:image/")) return true;
  return false;
}

function cleanElement(el: Element): void {
  for (const child of Array.from(el.children)) {
    const tag = child.tagName.toLowerCase();
    if (DANGEROUS.has(tag)) {
      child.remove();
      continue;
    }
    if (!ALLOWED_TAGS.has(tag)) {
      cleanElement(child);
      const parent = child.parentNode;
      if (parent) {
        while (child.firstChild) parent.insertBefore(child.firstChild, child);
        child.remove();
      }
      continue;
    }
    for (const attr of Array.from(child.attributes)) {
      const name = attr.name.toLowerCase();
      const allowed =
        ALLOWED_ATTRS[tag]?.has(name) || ALLOWED_ATTRS["*"].has(name);
      if (!allowed || name.startsWith("on")) {
        child.removeAttribute(attr.name);
        continue;
      }
      if ((name === "href" || name === "src") && !safeUrl(attr.value)) {
        child.removeAttribute(attr.name);
      }
    }
    if (tag === "a" && child.getAttribute("target") === "_blank") {
      child.setAttribute("rel", "noopener noreferrer");
    }
    cleanElement(child);
  }
}

/** Regex fallback for environments without DOM (SSR). */
function fallbackStrip(html: string): string {
  return html
    .replace(/<\s*(script|style|iframe|object|embed|form)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|link|meta|base)\b[^>]*>/gi, "")
    .replace(/\son\w+\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/javascript:/gi, "");
}

export function sanitizeRichHtml(html: string): string {
  if (!html) return "";
  if (typeof window === "undefined" || typeof DOMParser === "undefined") {
    return fallbackStrip(html);
  }
  const doc = new DOMParser().parseFromString(
    `<body><div id="rich-root">${html}</div></body>`,
    "text/html",
  );
  const root = doc.getElementById("rich-root");
  if (!root) return "";
  cleanElement(root);
  return root.innerHTML;
}
