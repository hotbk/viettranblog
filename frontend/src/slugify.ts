/**
 * Shared slug generator. Used to duplicate this logic per admin form
 * (AdminBookForm/AdminToolForm/AdminAccessGroups/PostForm each had their own
 * copy) and most of those copies never Unicode-decomposed the input before
 * stripping non a-z0-9 characters — a Vietnamese title like "Bài viết mới"
 * lost every accented letter's base character too (e.g. "mới" -> "mi"
 * instead of "moi"), because `[^a-z0-9-]` treats "ớ" as one opaque
 * character to delete rather than "o" + a stripped accent. `.normalize
 * ('NFD')` decomposes accented letters into base + combining marks first,
 * so only the combining marks get stripped and the base Latin letter
 * survives. "đ"/"Đ" don't decompose under NFD (they're not accent
 * variants), so they're mapped to "d" explicitly.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}
