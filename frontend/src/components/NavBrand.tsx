import { Link } from 'react-router-dom';

export default function NavBrand() {
  return (
    <Link to="/" className="site-nav__brand">
      <svg
        className="site-nav__mark"
        viewBox="0 0 100 100"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        {/* Icon mark: a terminal chevron ">" + two stacked data bars, cut as negative
            space from a solid rounded square — "querying data from the command line"
            in one glyph, so the mark reads as Database/DevOps/DBA/AI-specific rather
            than a generic tech-blog numeral. Bars (not thin seam lines) so the shape
            stays legible down to a 16px browser-tab favicon — see the same mask
            geometry duplicated in public/favicon.svg (standalone, no CSS var access). */}
        <mask id="t2b-icon-mask">
          <rect width="100" height="100" rx="24" fill="#fff" />
          <path
            d="M20,26 L47,50 L20,74"
            fill="none"
            stroke="#000"
            strokeWidth="14"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="54" y="58" width="26" height="11" rx="3" fill="#000" />
          <rect x="54" y="73" width="26" height="11" rx="3" fill="#000" />
        </mask>
        <rect width="100" height="100" rx="24" fill="var(--color-accent)" mask="url(#t2b-icon-mask)" />
      </svg>

      <span className="site-nav__wordmark">
        TECH<span className="site-nav__wordmark-two">2</span>BLOGS
      </span>
    </Link>
  );
}
