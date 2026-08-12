package com.example.blog.tool;

import com.example.blog.common.NotFoundException;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import java.io.IOException;
import java.util.List;
import java.util.Set;
import org.springframework.security.authentication.AnonymousAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Tool CRUD, listing, and the two gated public reads (cover image, raw HTML).
 * Unlike Post/Book/Exam, there is no access-group system here (see
 * ToolVisibility's javadoc) — PRIVATE is checked directly against the
 * caller's role, not resolved through PostAccessService-style group
 * membership. Kept deliberately simple: this module was not asked to grow
 * per-user/per-group tool sharing.
 */
@Service
public class ToolService {

    // Admin-authored HTML/CSS/JS artifact — generous relative to a blog post's
    // Markdown, but capped well below the book-file/video caps (docs/03
    // §4.3): this is meant to be a single self-contained page, not an asset
    // bundle. 1 MB covers the artifact-style reference this feature was built
    // for (~30-60 KB typical) many times over.
    static final long MAX_HTML_SOURCE_SIZE = 1024L * 1024; // 1 MB

    private static final long MAX_COVER_IMAGE_SIZE = 2L * 1024 * 1024; // 2 MB
    private static final Set<String> ALLOWED_COVER_TYPES = Set.of("image/jpeg", "image/png", "image/webp");
    // "Staff only" per ToolVisibility's javadoc — the PRIVATE bypass, checked directly
    // against the caller's role rather than through a group/grant model.
    private static final Set<UserRole> STAFF_ROLES = Set.of(UserRole.ADMIN, UserRole.EDITOR);

    private final ToolRepository toolRepository;
    private final ToolSourceRepository toolSourceRepository;
    private final UserRepository userRepository;

    public ToolService(ToolRepository toolRepository, ToolSourceRepository toolSourceRepository,
                        UserRepository userRepository) {
        this.toolRepository = toolRepository;
        this.toolSourceRepository = toolSourceRepository;
        this.userRepository = userRepository;
    }

    /**
     * includeDrafts=true is the admin listing (already ADMIN-gated by
     * SecurityConfig) and returns every tool unfiltered. The public path
     * requires PUBLISHED + PUBLIC (ToolRepository.search) and nothing else —
     * no teaser/omit distinction like Post's PUBLIC_METADATA (that machinery
     * exists to advertise gated content exists; a private tool has no
     *"request access" flow to advertise toward, so it's simply absent from
     * the public listing).
     */
    @Transactional(readOnly = true)
    public List<ToolResponse> search(String q, String category, boolean includeDrafts) {
        String normalizedQuery = blankToNull(q);
        String normalizedCategory = blankToNull(category);
        return toolRepository.search(normalizedQuery, normalizedCategory, includeDrafts).stream()
                .map(ToolResponse::from)
                .toList();
    }

    @Transactional(readOnly = true)
    public ToolResponse findBySlug(String slug) {
        Tool tool = toolRepository.findBySlug(slug)
                .filter(t -> t.getStatus() == ToolStatus.PUBLISHED && t.getVisibility() == ToolVisibility.PUBLIC)
                .orElseThrow(() -> new NotFoundException("TOOL_NOT_FOUND", "Tool not found"));
        return ToolResponse.from(tool);
    }

    /**
     * The one endpoint this whole module exists for: the raw HTML a public
     * reader's sandboxed iframe loads. Re-checks published+public itself
     * (doesn't trust the caller already having gone through findBySlug) so it
     * stays safe if ever called directly — 404, not 403, on a draft/private
     * tool, so a probing request can't distinguish "doesn't exist" from
     * "exists but not yours" (same oracle-avoidance convention as
     * PostAccessService, docs/03 §4.2).
     */
    @Transactional(readOnly = true)
    public String getRawHtml(String slug) {
        Tool tool = toolRepository.findBySlug(slug)
                .filter(t -> t.getStatus() == ToolStatus.PUBLISHED && t.getVisibility() == ToolVisibility.PUBLIC)
                .orElseThrow(() -> new NotFoundException("TOOL_NOT_FOUND", "Tool not found"));
        return toolSourceRepository.findByToolId(tool.getId())
                .map(ToolSource::getHtmlSource)
                .orElseThrow(() -> new NotFoundException("TOOL_NOT_FOUND", "Tool not found"));
    }

    /**
     * Same PUBLISHED+PUBLIC rule as {@link #getRawHtml}, except staff (ADMIN/EDITOR) bypass it —
     * this URL is also what {@code AdminToolResponse.coverImageUrl} points admins at while
     * editing a DRAFT/PRIVATE tool (PublicToolController.getCoverImage; there's no separate
     * gated admin image endpoint). Was previously unchecked entirely (any numeric id, no
     * visibility filter at all) until the caching pass on that controller surfaced it.
     */
    @Transactional(readOnly = true)
    public Tool getCoverImageTool(Long id) {
        Tool tool = toolRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("TOOL_NOT_FOUND", "Tool not found"));
        if (tool.getCoverImageData() == null) {
            throw new NotFoundException("TOOL_NOT_FOUND", "Tool not found");
        }
        boolean publiclyVisible = tool.getStatus() == ToolStatus.PUBLISHED && tool.getVisibility() == ToolVisibility.PUBLIC;
        if (!publiclyVisible && !isStaff()) {
            // Same oracle-avoidance convention as getRawHtml/PostAccessService: 404, not 403.
            throw new NotFoundException("TOOL_NOT_FOUND", "Tool not found");
        }
        return tool;
    }

    /**
     * Mirrors PostAccessService/BookAccessService's BYPASS_ROLES check, but standalone (per this
     * class's javadoc) since there's no group/grant model here to route through. Note this only
     * ever resolves true for a request that actually carried a valid Authorization header — a
     * plain {@code <img src>} load (which is how the admin cover-image preview above works) never
     * does, so staff still won't see a DRAFT/PRIVATE tool's cover thumbnail in the admin form.
     * That's an existing, non-regressing limitation shared with Post/Book's cover-image endpoints,
     * not something introduced here.
     */
    private boolean isStaff() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || !auth.isAuthenticated() || auth instanceof AnonymousAuthenticationToken) {
            return false;
        }
        return userRepository.findByUsername(auth.getName())
                .map(u -> STAFF_ROLES.contains(u.getRole()))
                .orElse(false);
    }

    /** Admin edit-form load — the one place htmlSource is ever sent as JSON. */
    @Transactional(readOnly = true)
    public AdminToolResponse getAdminDetail(Long id) {
        Tool tool = toolRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("TOOL_NOT_FOUND", "Tool not found"));
        String html = toolSourceRepository.findByToolId(id).map(ToolSource::getHtmlSource).orElse("");
        return AdminToolResponse.from(tool, html);
    }

    @Transactional
    public ToolResponse create(ToolRequest request, MultipartFile coverImage, Long createdBy) {
        requireNonBlank(request.title(), "Title is required");
        String slug = requireNonBlank(request.slug(), "Slug is required");
        if (toolRepository.existsBySlug(slug)) {
            throw new IllegalArgumentException("Slug already exists");
        }
        String html = requireNonBlank(request.htmlSource(), "HTML source is required");
        validateHtmlSize(html);

        Tool tool = new Tool();
        applyRequest(tool, request);
        tool.setCreatedBy(createdBy);
        if (coverImage != null && !coverImage.isEmpty()) {
            applyCoverImage(tool, coverImage);
        }
        Tool saved = toolRepository.save(tool);

        ToolSource source = new ToolSource();
        source.setTool(saved);
        source.setHtmlSource(html);
        toolSourceRepository.save(source);

        return ToolResponse.from(saved);
    }

    @Transactional
    public ToolResponse update(Long id, ToolRequest request, MultipartFile coverImage, boolean removeCoverImage) {
        Tool tool = toolRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("TOOL_NOT_FOUND", "Tool not found"));
        requireNonBlank(request.title(), "Title is required");
        String newSlug = requireNonBlank(request.slug(), "Slug is required");
        if (!tool.getSlug().equals(newSlug) && toolRepository.existsBySlugAndIdNot(newSlug, id)) {
            throw new IllegalArgumentException("Slug already exists");
        }
        applyRequest(tool, request);
        if (removeCoverImage) {
            clearCoverImage(tool);
        } else if (coverImage != null && !coverImage.isEmpty()) {
            applyCoverImage(tool, coverImage);
        }
        Tool saved = toolRepository.save(tool);

        // Blank/absent htmlSource on update = "leave the existing source
        // alone" (ToolRequest's javadoc) — lets an admin edit just the
        // metadata (title, category, status...) without re-pasting the HTML.
        if (request.htmlSource() != null && !request.htmlSource().isBlank()) {
            validateHtmlSize(request.htmlSource());
            ToolSource source = toolSourceRepository.findByToolId(id).orElseGet(() -> {
                ToolSource s = new ToolSource();
                s.setTool(saved);
                return s;
            });
            source.setHtmlSource(request.htmlSource());
            toolSourceRepository.save(source);
        }

        return ToolResponse.from(saved);
    }

    @Transactional
    public void delete(Long id) {
        if (!toolRepository.existsById(id)) {
            throw new NotFoundException("TOOL_NOT_FOUND", "Tool not found");
        }
        // tool_sources has a required tool_id FK, not DB-cascaded (nothing in
        // this codebase uses ON DELETE CASCADE, docs/03 §4.2) — clean it up
        // first or this 500s, the same bug class already shipped twice
        // elsewhere (post_attachments, exam access grants).
        toolSourceRepository.deleteByToolId(id);
        toolRepository.deleteById(id);
    }

    @Transactional
    public void recordView(String slug) {
        toolRepository.findBySlug(slug)
                .filter(t -> t.getStatus() == ToolStatus.PUBLISHED)
                .ifPresent(t -> {
                    t.setViewCount(t.getViewCount() + 1);
                    toolRepository.save(t);
                });
    }

    // --- helpers ---

    private static void applyRequest(Tool tool, ToolRequest request) {
        tool.setTitle(request.title().trim());
        tool.setSlug(request.slug().trim());
        tool.setCategory(request.category());
        tool.setTags(Tags.toStorage(request.tags()));
        tool.setExcerpt(request.excerpt());
        tool.setStatus(request.status());
        tool.setVisibility(request.visibility() != null ? request.visibility() : ToolVisibility.PUBLIC);
    }

    private static void validateHtmlSize(String html) {
        // String.length() is UTF-16 code units, not bytes — close enough for
        // an app-level guardrail on mostly-ASCII markup; not a precise byte
        // accounting the way MultipartFile.getSize() is for uploads.
        if (html.length() > MAX_HTML_SOURCE_SIZE) {
            throw new IllegalArgumentException("HTML source exceeds maximum allowed size of 1 MB");
        }
    }

    private static void applyCoverImage(Tool tool, MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_COVER_TYPES.contains(contentType)) {
            throw new IllegalArgumentException(
                    "Invalid image type. Allowed types: image/jpeg, image/png, image/webp");
        }
        if (file.getSize() > MAX_COVER_IMAGE_SIZE) {
            throw new IllegalArgumentException("Cover image exceeds maximum allowed size of 2 MB");
        }
        try {
            tool.setCoverImageData(file.getBytes());
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read cover image: " + e.getMessage());
        }
        tool.setCoverImageContentType(contentType);
        tool.setCoverImageOriginalFilename(file.getOriginalFilename());
        tool.setCoverImageSize(file.getSize());
    }

    private static void clearCoverImage(Tool tool) {
        tool.setCoverImageData(null);
        tool.setCoverImageContentType(null);
        tool.setCoverImageOriginalFilename(null);
        tool.setCoverImageSize(null);
    }

    private static String requireNonBlank(String value, String message) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return value.trim();
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }
}
