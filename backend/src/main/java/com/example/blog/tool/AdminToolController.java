package com.example.blog.tool;

import com.example.blog.user.UserService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

/**
 * ADMIN-only (matcher: {@code /api/admin/**}, docs/03 §8.1) — no EDITOR
 * access, same convention as {@code /api/admin/images}/{@code /videos} and
 * unlike {@code /api/posts}' write endpoints, which do allow EDITOR.
 * Deliberate: this module was scoped for a single trusted admin authoring
 * arbitrary unsandboxed-at-write-time HTML (docs/04 §11 "risks and limits").
 */
@RestController
@RequestMapping("/api/admin/tools")
public class AdminToolController {

    private final ToolService toolService;
    private final UserService userService;

    public AdminToolController(ToolService toolService, UserService userService) {
        this.toolService = toolService;
        this.userService = userService;
    }

    @GetMapping
    public List<ToolResponse> listAll() {
        return toolService.search(null, null, true);
    }

    @GetMapping("/{id}")
    public AdminToolResponse get(@PathVariable Long id) {
        return toolService.getAdminDetail(id);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public ToolResponse create(
            @RequestParam String title,
            @RequestParam String slug,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String tags,
            @RequestParam(required = false) String excerpt,
            @RequestParam String htmlSource,
            @RequestParam ToolStatus status,
            @RequestParam(defaultValue = "PUBLIC") ToolVisibility visibility,
            @RequestPart(required = false) MultipartFile coverImage) {

        ToolRequest request = new ToolRequest(title, slug, category, parseTags(tags), excerpt, htmlSource,
                status, visibility);
        return toolService.create(request, coverImage, userService.currentUserIdOrNull());
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ToolResponse update(
            @PathVariable Long id,
            @RequestParam String title,
            @RequestParam String slug,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String tags,
            @RequestParam(required = false) String excerpt,
            // Blank/absent = leave the existing HTML source untouched (ToolRequest javadoc).
            @RequestParam(required = false) String htmlSource,
            @RequestParam ToolStatus status,
            @RequestParam(defaultValue = "PUBLIC") ToolVisibility visibility,
            @RequestPart(required = false) MultipartFile coverImage,
            @RequestParam(required = false, defaultValue = "false") boolean removeCoverImage) {

        ToolRequest request = new ToolRequest(title, slug, category, parseTags(tags), excerpt, htmlSource,
                status, visibility);
        return toolService.update(id, request, coverImage, removeCoverImage);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        toolService.delete(id);
    }

    private static List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return List.of(tags.split(",")).stream()
                .map(String::trim)
                .filter(t -> !t.isBlank())
                .toList();
    }
}
