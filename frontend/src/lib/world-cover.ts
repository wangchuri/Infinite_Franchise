/** Cover gradients from docs/prototype/web-preview.html (.c1–.c4 + hue variants). */

export const WORLD_COVER_GRADIENTS = [
  "linear-gradient(145deg, #1f5c5a, #0f2a32 60%, #c45c26)",
  "linear-gradient(145deg, #2a3a47, #5b6e7a, #c5d0c8)",
  "linear-gradient(145deg, #3d2a1f, #8a5a3a, #e8d5b5)",
  "linear-gradient(145deg, #1a2f4a, #3d6b8a, #a8c4d4)",
  "linear-gradient(145deg, #2f6b4a, #1a3a32 55%, #c45c26)",
  "linear-gradient(145deg, #4a3a5a, #6e5b7a, #c5d0c8)",
] as const;

/** Stable index from id/slug so the same world keeps the same gradient. */
export function coverGradientFor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return WORLD_COVER_GRADIENTS[hash % WORLD_COVER_GRADIENTS.length];
}

export function worldCoverImage(world: {
  coverUrl?: string | null;
  wikiBackgroundUrl?: string | null;
  logoUrl?: string | null;
}): string | null {
  return world.coverUrl || world.wikiBackgroundUrl || world.logoUrl || null;
}
