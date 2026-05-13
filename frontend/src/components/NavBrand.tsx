import { Link } from 'react-router-dom';

export default function NavBrand() {
  return (
    <Link to="/" className="site-nav__brand">
      <svg
        className="site-nav__mark"
        viewBox="0 0 40 40"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <defs>
          <linearGradient id="vt-bg" x1="0" y1="0" x2="40" y2="40" gradientUnits="userSpaceOnUse">
            <stop stopColor="#FBBF24" />
            <stop offset="1" stopColor="#D97706" />
          </linearGradient>
        </defs>
        <rect width="40" height="40" rx="9" fill="url(#vt-bg)" />
        {/* T crossbar — shared top bar of V */}
        <path d="M8 14H32" stroke="#1a2744" strokeWidth="3" strokeLinecap="round" />
        {/* V left arm */}
        <path d="M10 14L20 28" stroke="#1a2744" strokeWidth="3" strokeLinecap="round" />
        {/* V right arm */}
        <path d="M30 14L20 28" stroke="#1a2744" strokeWidth="3" strokeLinecap="round" />
      </svg>

      <div className="site-nav__wordmark">
        <span className="site-nav__wordmark-primary">viettran</span>
        <span className="site-nav__wordmark-secondary">Blog</span>
      </div>
    </Link>
  );
}
