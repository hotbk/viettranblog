import { useEffect } from 'react';

const SITE_NAME = 'TECH2BLOGS';

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

function upsertLink(rel: string, href: string) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
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
export function useSeo(opts: SeoOptions) {
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

    upsertJsonLd(opts.jsonLd);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [opts.title, opts.description, opts.path, opts.type, opts.image, opts.noindex, JSON.stringify(opts.jsonLd)]);
}
