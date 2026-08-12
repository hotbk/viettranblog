import { useMemo } from 'react';
import type { BlogPost } from '../types';

// Rank-based tiers (not raw-value scaling) so one viral post can't blow the
// cloud out of proportion — a tag's size/weight/darkness reflects its rank
// among today's tags, not an absolute view count that means nothing on its
// own. "mức độ quan tâm" (interest) is approximated from total reads across
// a tag's posts — this app has no search-query log to weight by actual
// search frequency, so viewCount is the closest signal already on hand.
const TIERS = [
  { fontSize: 22, fontWeight: 800, opacity: 1 },
  { fontSize: 19, fontWeight: 700, opacity: 0.9 },
  { fontSize: 16, fontWeight: 650, opacity: 0.78 },
  { fontSize: 14, fontWeight: 550, opacity: 0.68 },
  { fontSize: 13, fontWeight: 500, opacity: 0.58 },
];

const MAX_TAGS = 24;

interface WeightedTag {
  tag: string;
  weight: number;
}

function weighTags(posts: BlogPost[]): WeightedTag[] {
  const weights = new Map<string, number>();
  for (const post of posts) {
    for (const tag of post.tags) {
      weights.set(tag, (weights.get(tag) ?? 0) + (post.viewCount ?? 0));
    }
  }
  return Array.from(weights.entries())
    .map(([tag, weight]) => ({ tag, weight }))
    .sort((a, b) => b.weight - a.weight || a.tag.localeCompare(b.tag))
    .slice(0, MAX_TAGS);
}

export default function TagCloud({
  posts,
  selectedTag,
  onSelectTag,
  visible,
  onToggleVisible,
}: {
  posts: BlogPost[];
  selectedTag: string | null;
  onSelectTag: (tag: string | null) => void;
  visible: boolean;
  onToggleVisible: (visible: boolean) => void;
}) {
  const weighted = useMemo(() => weighTags(posts), [posts]);

  // Nothing to weigh yet (still loading, or a query with zero results) — the
  // toggle would just control an empty box, so skip the whole section rather
  // than show it. Once posts arrive on a later render this returns normally.
  if (weighted.length === 0) return null;

  return (
    <div className="tag-cloud">
      <div className="tag-cloud__header">
        <span className="tag-cloud__title">Popular topics</span>
        <label className="tag-cloud__toggle">
          <input
            type="checkbox"
            checked={visible}
            onChange={(e) => onToggleVisible(e.target.checked)}
          />
          <span>Show</span>
        </label>
      </div>

      {visible && (
        <div className="tag-cloud__cloud">
          {weighted.map(({ tag }, index) => {
            const tier = TIERS[Math.min(TIERS.length - 1, Math.floor((index / weighted.length) * TIERS.length))];
            const isSelected = tag === selectedTag;
            return (
              <button
                key={tag}
                type="button"
                className={`tag-cloud__tag${isSelected ? ' tag-cloud__tag--selected' : ''}`}
                style={{ fontSize: tier.fontSize, fontWeight: tier.fontWeight, opacity: isSelected ? 1 : tier.opacity }}
                onClick={() => onSelectTag(isSelected ? null : tag)}
                aria-pressed={isSelected}
              >
                #{tag}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
