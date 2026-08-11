package com.example.blog.tool;

import java.nio.charset.StandardCharsets;
import java.util.List;
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
        return ResponseEntity.ok()
                .contentType(new MediaType("text", "html", StandardCharsets.UTF_8))
                .header("X-Frame-Options", "SAMEORIGIN")
                .header("Content-Security-Policy", "frame-ancestors 'self'")
                .body(html);
    }

    @GetMapping("/api/tools/{id}/cover-image")
    public ResponseEntity<byte[]> getCoverImage(@PathVariable Long id) {
        Tool tool = toolService.getCoverImageTool(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(tool.getCoverImageContentType()))
                .body(tool.getCoverImageData());
    }

    @PostMapping("/api/tools/{slug}/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordView(@PathVariable String slug) {
        toolService.recordView(slug);
    }
}
