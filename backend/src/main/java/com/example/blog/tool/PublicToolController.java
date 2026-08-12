package com.example.blog.tool;

import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicToolController {

    private final ToolService toolService;

    public PublicToolController(ToolService toolService) {
        this.toolService = toolService;
    }

    @GetMapping("/api/tools")
    public List<ToolResponse> search(@RequestParam(required = false) String q,
                                      @RequestParam(required = false) String category) {
        return toolService.search(q, category, false);
    }

    @GetMapping("/api/tools/{slug}")
    public ToolResponse findBySlug(@PathVariable String slug) {
        return toolService.findBySlug(slug);
    }

    /**
     * The public artifact page's iframe src. Deliberately NOT under a JSON
     * content type: returns the pasted HTML/CSS/JS byte-for-byte with
     * {@code text/html}, no site layout, no escaping — see ToolSource's
     * javadoc for the trust model. `X-Frame-Options`/CSP `frame-ancestors`
     * are scoped to this endpoint only (not the site-wide policy) so another
     * site cannot iframe a tool and, e.g., clickjack its buttons — the tool's
     * own inline scripts otherwise run completely unrestricted (no CSP here)
     * because that is the whole point of the feature (docs/03 §4.6).
     */
    @GetMapping("/api/tools/{slug}/raw")
    public ResponseEntity<String> raw(@PathVariable String slug) {
        String html = toolService.getRawHtml(slug);
        // getRawHtml already 404s unless PUBLISHED+PUBLIC, so by this point the content is
        // unconditionally safe for a shared cache — unlike the two cover-image endpoints below.
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
                .header("X-Frame-Options", "SAMEORIGIN")
                .header("Content-Security-Policy", "frame-ancestors 'self'")
                .cacheControl(CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic())
                .body(html);
    }

    @GetMapping("/api/tools/{id}/cover-image")
    public ResponseEntity<byte[]> getCoverImage(@PathVariable Long id) {
        // getCoverImageTool now 404s a DRAFT/PRIVATE tool's cover for anyone but staff (fixed
        // alongside this caching pass — see its javadoc). A staff caller can still reach the
        // PRIVATE branch below, so this stays visibility-conditional rather than always-public:
        // a shared/CDN cache must never be handed a PRIVATE tool's cover to serve back to anyone else.
        Tool tool = toolService.getCoverImageTool(id);
        CacheControl cacheControl = tool.getVisibility() == ToolVisibility.PUBLIC
                ? CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic()
                : CacheControl.noStore();
        return ResponseEntity.ok()
                .cacheControl(cacheControl)
                .contentType(MediaType.parseMediaType(tool.getCoverImageContentType()))
                .body(tool.getCoverImageData());
    }

    @PostMapping("/api/tools/{slug}/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordView(@PathVariable String slug) {
        toolService.recordView(slug);
    }
}
