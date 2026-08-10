import { useEffect } from 'react';

const SITE_NAME = 'TECH2BLOGS';

/** hreflang code ('vi' | 'en' | 'x-default') + the path it points at, e.g. `/posts/my-slug`. */
export interface SeoAlternate {
  hreflang: string;
  path: string;
}

export interface SeoOptions {
  /** Page-specific title. The site name is appended automatically if not already present. */
  title: string;
  /** ~150-160 chars, no markup. */
  description: string;
  /** Path used to build the canonical/og:url, e.g. `/posts/my-slug`. Defaults to the current path. */
  path?: string;
  type?: 'website' | 'article';
  /** Absolute or origin-relative image URL for social previews. */
  image?: string;
  /** True for pages that must never be indexed (private/denied/not-found content, admin & member areas). */
  noindex?: boolean;
  /** Arbitrary JSON-LD payload (e.g. a BlogPosting or Blog schema.org object). */
  jsonLd?: Record<string, unknown>;
  /** BCP-47 code ('vi' | 'en') for this page's content — sets <html lang> and og:locale
   * (docs/10-multilingual-content.md §5.2). Omitted for language-agnostic pages (home, library). */
  lang?: string;
  /** `<link rel="alternate" hreflang>` entries — include self and 'x-default' per Google's
   * reciprocal/self-inclusive rule (docs/10 §5.2). Empty/omitted renders none (e.g. a post
   * with no translation yet). */
  alternates?: SeoAlternate[];
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

/** Removes a meta tag entirely — used for meta[@property] that only exists on some
 * pages (e.g. og:locale:alternate), so a value set by the previous route doesn't
 * silently persist onto a page that has none (same class of bug as R6 below). */
function removeMeta(attr: 'name' | 'property', key: string) {
  document.head.querySelector<HTMLMetaElement>(`meta[${attr}="${key}"]`)?.remove();
}

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
}

// R6 (docs/10-multilingual-content.md §5.2, §8): the naive `upsertLink` above keys on
// `rel` alone, so it can only ever hold ONE `<link rel="alternate">`. hreflang needs N of
// them, and because this is an SPA where useSeo overwrites the previous page's tags on
// every navigation, a naive per-rel upsert would leave a *previous* article's alternates
// in <head> after navigating to a new one — silently asserting a wrong translation
// relationship. Fixed by removing every previously-appended alternate (tagged with
// data-seo-alt so this never touches an unrelated rel="alternate" link) before appending
// the current page's set. Manually verified: navigate post A -> post B, A's alternates
// are gone from <head> (see FE-L6 in TASKS.md for how this was checked).
function replaceAlternateLinks(alternates: SeoAlternate[] | undefined) {
  document.head.querySelectorAll('link[rel="alternate"][data-seo-alt]').forEach((el) => el.remove());
  if (!alternates || alternates.length === 0) return;
  for (const alt of alternates) {
    const el = document.createElement('link');
    el.setAttribute('rel', 'alternate');
    el.setAttribute('hreflang', alt.hreflang);
    el.setAttribute('href', window.location.origin + alt.path);
    el.setAttribute('data-seo-alt', '');
    document.head.appendChild(el);
  }
}

const OG_LOCALE: Record<string, string> = { vi: 'vi_VN', en: 'en_US' };

/** og:locale from a bcp47 code ('vi'/'en'); falls back to the code itself for a future
 * third language rather than silently omitting the tag. */
function ogLocale(bcp47: string): string {
  return OG_LOCALE[bcp47] ?? bcp47;
}

const JSON_LD_ID = 'seo-jsonld';

function upsertJsonLd(data: Record<string, unknown> | undefined) {
  const existing = document.getElementById(JSON_LD_ID);
  if (!data) {
    existing?.remove();
    return;
  }
  let el = existing as HTMLScriptElement | null;
  if (!el) {
    el = document.createElement('script');
    el.id = JSON_LD_ID;
    el.type = 'application/ld+json';
    document.head.appendChild(el);
  }
  el.textContent = JSON.stringify(data);
}

/**
 * Sets document title + meta description/robots/canonical/OG/Twitter tags + optional JSON-LD
 * for the current page, client-side. No react-helmet dependency — plain DOM upserts, since every
 * route in this SPA calls this hook on mount and simply overwrites whatever the previous page set.
 *
 * Known limitation: this only affects the DOM after JS runs. Google's indexer executes JS before
 * reading <head>, so organic search indexing works correctly. Crawlers that DON'T execute JS
 * (some link-preview bots for chat apps) will only ever see index.html's static fallback tags,
 * not these per-page ones — fixing that needs server-side rendering/prerendering, out of scope here.
 */
const DEFAULT_HTML_LANG = 'en';

export function useSeo(opts: SeoOptions) {
  // Extracted so the dependency array below holds plain variables, not inline
  // expressions — silences react-hooks/exhaustive-deps's "complex expression" warning.
  const alternatesKey = JSON.stringify(opts.alternates);
  const jsonLdKey = JSON.stringify(opts.jsonLd);

  useEffect(() => {
    const fullTitle = opts.title.includes(SITE_NAME) ? opts.title : `${opts.title} | ${SITE_NAME}`;
    document.title = fullTitle;

    upsertMeta('name', 'description', opts.description);
    upsertMeta('name', 'robots', opts.noindex ? 'noindex, nofollow' : 'index, follow');

    const url = window.location.origin + (opts.path ?? window.location.pathname);
    upsertLink('canonical', url);

    upsertMeta('property', 'og:site_name', SITE_NAME);
    upsertMeta('property', 'og:type', opts.type ?? 'website');
    upsertMeta('property', 'og:title', fullTitle);
    upsertMeta('property', 'og:description', opts.description);
    upsertMeta('property', 'og:url', url);
    if (opts.image) upsertMeta('property', 'og:image', opts.image);

    upsertMeta('name', 'twitter:card', opts.image ? 'summary_large_image' : 'summary');
    upsertMeta('name', 'twitter:title', fullTitle);
    upsertMeta('name', 'twitter:description', opts.description);
    if (opts.image) upsertMeta('name', 'twitter:image', opts.image);

    // --- Dual-language content (docs/10-multilingual-content.md §5.2) ---
    // index.html hardcodes <html lang="en"> for every page including Vietnamese
    // ones — a pre-existing accessibility/SEO defect this feature fixes.
    document.documentElement.lang = opts.lang ?? DEFAULT_HTML_LANG;

    upsertMeta('property', 'og:locale', ogLocale(opts.lang ?? DEFAULT_HTML_LANG));
    // og:locale:alternate only applies when a sibling in another language exists —
    // build it from the alternates list, excluding self and x-default, same
    // "not every page has one" reasoning as R6 above.
    const altLocale = opts.alternates?.find((a) => a.hreflang !== opts.lang && a.hreflang !== 'x-default');
    if (altLocale) {
      upsertMeta('property', 'og:locale:alternate', ogLocale(altLocale.hreflang));
    } else {
      removeMeta('property', 'og:locale:alternate');
    }
    replaceAlternateLinks(opts.alternates);

    upsertJsonLd(opts.jsonLd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    opts.title, opts.description, opts.path, opts.type, opts.image, opts.noindex,
    opts.lang, alternatesKey, jsonLdKey,
  ]);
}
