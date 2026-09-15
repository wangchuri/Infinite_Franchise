/**
 * `[[词条名]]` / `[[词条名|显示文字]]` references inside Markdown become links
 * to that entry's page. Unknown references are left as-is.
 */
export type EntryRef = { title: string; slug: string; aliases?: string[] };

const REF = /\[\[([^\]|]+?)(?:\|([^\]]+?))?\]\]/g;

export function linkifyEntryRefs(
  markdown: string,
  worldSlug: string,
  entries: EntryRef[],
): string {
  if (!markdown.includes("[[")) return markdown;
  return markdown.replace(REF, (whole, title: string, label?: string) => {
    const raw = title.trim();
    const found = entries.find(
      (e) =>
        e.title === raw ||
        e.slug === raw ||
        (e.aliases ?? []).some((a) => a === raw),
    );
    if (!found) return whole;
    const text = (label ? label.trim() : raw) || raw;
    return `[${text}](/w/${worldSlug}/entry/${found.slug})`;
  });
}
