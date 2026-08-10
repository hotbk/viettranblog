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
        {/* Icon mark: the numeral "2" cut as negative space from a solid rounded square,
            framed by a pair of bracket ticks — "[2]" — the system's data/code notation
            signal. Same "2" path as the wordmark, reused as the brand's icon/favicon asset. */}
        <mask id="t2b-icon-mask">
          <rect width="100" height="100" rx="24" fill="#fff" />
          <path
            d="M9.33,18.48 A22,22 0 1,1 41,45.05 L8,96 L52,96"
            fill="none"
            stroke="#000"
            strokeWidth="24"
            strokeLinecap="round"
            strokeLinejoin="round"
            transform="translate(33.3,14) scale(0.76) translate(-8,-4)"
          />
          <path
            d="M16,32 V68 M16,32 H24 M16,68 H24"
            fill="none"
            stroke="#000"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M84,32 V68 M84,32 H76 M84,68 H76"
            fill="none"
            stroke="#000"
            strokeWidth="9"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </mask>
        <rect width="100" height="100" rx="24" fill="var(--color-accent)" mask="url(#t2b-icon-mask)" />
      </svg>

      <span className="site-nav__wordmark">
        TECH<span className="site-nav__wordmark-two">2</span>BLOGS
      </span>
    </Link>
  );
}
