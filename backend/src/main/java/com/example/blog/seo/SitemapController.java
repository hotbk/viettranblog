package com.example.blog.seo;

import com.example.blog.post.Post;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostStatus;
import com.example.blog.post.PostVisibility;
import com.example.blog.series.Series;
import com.example.blog.series.SeriesRepository;
import java.time.Duration;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.CacheControl;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

/**
 * Generates sitemap.xml on the fly from PUBLISHED + PUBLIC content, so it's always current
 * without a rebuild/deploy. Served here at /api/sitemap.xml; per the sitemap protocol it must be
 * reachable at the site root (/sitemap.xml) in production — see the vite dev proxy in
 * vite.config.ts and the nginx note in docs/07-deployment-guide.md.
 */
@RestController
public class SitemapController {

    private final PostRepository postRepository;
    private final SeriesRepository seriesRepository;
    private final String publicBaseUrl;

    public SitemapController(PostRepository postRepository,
                              SeriesRepository seriesRepository,
                              @Value("${blog.public-base-url}") String publicBaseUrl) {
        this.postRepository = postRepository;
        this.seriesRepository = seriesRepository;
        this.publicBaseUrl = publicBaseUrl.endsWith("/")
                ? publicBaseUrl.substring(0, publicBaseUrl.length() - 1)
                : publicBaseUrl;
    }

    @GetMapping(value = "/api/sitemap.xml", produces = MediaType.APPLICATION_XML_VALUE)
    public ResponseEntity<String> sitemap() {
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        // xhtml namespace is required for the <xhtml:link rel="alternate" hreflang="..."> elements
        // below (docs/10-multilingual-content.md §5.1).
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\" ")
                .append("xmlns:xhtml=\"http://www.w3.org/1999/xhtml\">\n");

        appendUrl(xml, publicBaseUrl + "/", null, "daily", "1.0", List.of());
        appendUrl(xml, publicBaseUrl + "/series", null, "weekly", "0.5", List.of());

        // PUBLISHED + PUBLIC only, deliberately — the same filtered list a DRAFT
        // or PRIVATE sibling must never leak out of, including as an alternate
        // (docs/10 §5.1). The hreflang map is built from this already-filtered
        // in-memory result set, no extra query.
        List<Post> publicPosts = postRepository.findByStatusAndVisibility(PostStatus.PUBLISHED,
                PostVisibility.PUBLIC);
        Map<Long, List<Post>> byGroup = publicPosts.stream()
                .collect(Collectors.groupingBy(Post::getTranslationGroupId));
        for (Post post : publicPosts) {
            List<Post> group = byGroup.get(post.getTranslationGroupId());
            appendUrl(xml, publicBaseUrl + "/posts/" + post.getSlug(), post.getUpdatedAt(), "weekly", "0.8",
                    alternatesFor(post, group));
        }
        for (Series series : seriesRepository.findByStatus(PostStatus.PUBLISHED)) {
            appendUrl(xml, publicBaseUrl + "/series/" + series.getSlug(), series.getUpdatedAt(), "weekly", "0.6",
                    List.of());
        }

        xml.append("</urlset>\n");
        // PUBLISHED+PUBLIC only (queried above), so unconditionally safe for a shared cache.
        // 1h balances "a new post shows up for crawlers reasonably soon" against not rebuilding
        // this from two full table scans on every crawler hit — the sitemap protocol doesn't
        // expect realtime freshness anyway.
        return ResponseEntity.ok()
                .cacheControl(CacheControl.maxAge(Duration.ofHours(1)).cachePublic())
                .body(xml.toString());
    }

    /**
     * hreflang alternates for one post's <url> block. A group of one (every
     * post today, until a real translation pair exists) emits nothing — see
     * docs/10-multilingual-content.md §5.1. Every URL lists every alternate
     * including itself (reciprocal + self-inclusive), and x-default points at
     * the original-language URL (translatedFromId == null within the group;
     * falls back to this post if that row isn't in the public set either).
     */
    private List<Alternate> alternatesFor(Post post, List<Post> group) {
        if (group.size() < 2) {
            return List.of();
        }
        List<Alternate> alternates = group.stream()
                .sorted(Comparator.comparing(p -> p.getLanguage().bcp47()))
                .map(p -> new Alternate(p.getLanguage().bcp47(), publicBaseUrl + "/posts/" + p.getSlug()))
                .collect(Collectors.toCollection(ArrayList::new));
        Post original = group.stream().filter(p -> p.getTranslatedFromId() == null).findFirst().orElse(post);
        alternates.add(new Alternate("x-default", publicBaseUrl + "/posts/" + original.getSlug()));
        return alternates;
    }

    private record Alternate(String hreflang, String href) {
    }

    private void appendUrl(StringBuilder xml, String loc, Instant lastmod, String changefreq, String priority,
                            List<Alternate> alternates) {
        xml.append("  <url>\n");
        xml.append("    <loc>").append(escapeXml(loc)).append("</loc>\n");
        for (Alternate alt : alternates) {
            xml.append("    <xhtml:link rel=\"alternate\" hreflang=\"").append(escapeXml(alt.hreflang()))
                    .append("\" href=\"").append(escapeXml(alt.href())).append("\"/>\n");
        }
        if (lastmod != null) {
            xml.append("    <lastmod>")
                    .append(DateTimeFormatter.ISO_INSTANT.format(lastmod.truncatedTo(ChronoUnit.SECONDS)))
                    .append("</lastmod>\n");
        }
        xml.append("    <changefreq>").append(changefreq).append("</changefreq>\n");
        xml.append("    <priority>").append(priority).append("</priority>\n");
        xml.append("  </url>\n");
    }

    private String escapeXml(String s) {
        return s.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
                .replace("\"", "&quot;")
                .replace("'", "&apos;");
    }
}
