package com.example.blog.seo;

import com.example.blog.post.Post;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostStatus;
import com.example.blog.post.PostVisibility;
import com.example.blog.series.Series;
import com.example.blog.series.SeriesRepository;
import java.time.Instant;
import java.time.format.DateTimeFormatter;
import java.time.temporal.ChronoUnit;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
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
    public String sitemap() {
        StringBuilder xml = new StringBuilder();
        xml.append("<?xml version=\"1.0\" encoding=\"UTF-8\"?>\n");
        xml.append("<urlset xmlns=\"http://www.sitemaps.org/schemas/sitemap/0.9\">\n");

        appendUrl(xml, publicBaseUrl + "/", null, "daily", "1.0");
        appendUrl(xml, publicBaseUrl + "/series", null, "weekly", "0.5");

        for (Post post : postRepository.findByStatusAndVisibility(PostStatus.PUBLISHED, PostVisibility.PUBLIC)) {
            appendUrl(xml, publicBaseUrl + "/posts/" + post.getSlug(), post.getUpdatedAt(), "weekly", "0.8");
        }
        for (Series series : seriesRepository.findByStatus(PostStatus.PUBLISHED)) {
            appendUrl(xml, publicBaseUrl + "/series/" + series.getSlug(), series.getUpdatedAt(), "weekly", "0.6");
        }

        xml.append("</urlset>\n");
        return xml.toString();
    }

    private void appendUrl(StringBuilder xml, String loc, Instant lastmod, String changefreq, String priority) {
        xml.append("  <url>\n");
        xml.append("    <loc>").append(escapeXml(loc)).append("</loc>\n");
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
