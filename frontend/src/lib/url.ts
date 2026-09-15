/**
 * Next.js passes dynamic-route params percent-encoded (e.g. a Chinese slug
 * arrives as `%E7%AB%A0%E8%8A%82`). Decode before comparing to stored slugs/
 * keys so CJK names work.
 */
export function decodeParam(value: string | undefined | null): string {
  if (!value) return "";
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function findEntryBySlug<T extends { slug: string }>(
  entries: T[],
  slug: string,
): T | null {
  const decoded = decodeParam(slug);
  return entries.find((e) => e.slug === decoded) ?? null;
}
