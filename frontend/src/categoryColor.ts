const PALETTE_SIZE = 6;

/**
 * Deterministic category → color-swatch class name, e.g. "category-badge--3".
 * Categories are free-text (admin-entered), not a fixed enum, so instead of a
 * lookup table that needs updating every time someone adds a category, hash
 * the string to one of a fixed set of hues (defined as --cat-N-* tokens and
 * .category-badge--N classes in styles.css). Same category name always maps
 * to the same hue; two different categories will usually land on different
 * hues but can collide (6 slots) — acceptable for a "scan faster" aid, not a
 * strict identity signal.
 */
export function categoryColorClass(category: string): string {
  let hash = 0;
  for (let i = 0; i < category.length; i++) {
    hash = (hash * 31 + category.charCodeAt(i)) | 0;
  }
  const index = (Math.abs(hash) % PALETTE_SIZE) + 1;
  return `category-badge--${index}`;
}
