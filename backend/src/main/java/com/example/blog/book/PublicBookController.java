package com.example.blog.book;

import com.example.blog.access.BookAccessService;
import com.example.blog.common.ContentLanguage;
import com.example.blog.common.NotFoundException;
import com.example.blog.user.User;
import jakarta.validation.Valid;
import java.time.Duration;
import java.util.List;
import org.springframework.http.CacheControl;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class PublicBookController {

    /** Not a Spring-provided HttpHeaders constant — this is a Spring Security header name. */
    private static final String X_CONTENT_TYPE_OPTIONS = "X-Content-Type-Options";

    private final BookService bookService;
    private final BookProgressService bookProgressService;
    private final BookHighlightService bookHighlightService;
    private final BookAccessService bookAccessService;

    public PublicBookController(BookService bookService, BookProgressService bookProgressService,
                                 BookHighlightService bookHighlightService, BookAccessService bookAccessService) {
        this.bookService = bookService;
        this.bookProgressService = bookProgressService;
        this.bookHighlightService = bookHighlightService;
        this.bookAccessService = bookAccessService;
    }

    @GetMapping("/api/books")
    public List<BookResponse> list(@RequestParam(required = false) String q,
                                    @RequestParam(required = false) String category,
                                    @RequestParam(required = false) BookFileType fileType,
                                    @RequestParam(required = false) ContentLanguage language) {
        return bookService.search(q, category, fileType, false, language);
    }

    @GetMapping("/api/books/{slug}")
    public BookResponse findBySlug(@PathVariable String slug) {
        return bookService.findBySlug(slug);
    }

    @GetMapping("/api/books/{id}/cover-image")
    public ResponseEntity<byte[]> getCoverImage(@PathVariable Long id) {
        Book book = bookService.getCoverImageBook(id);
        // Same reasoning as PostController.getCoverImage: only PUBLIC is safe for a shared
        // cache, since bookAccessService.canRead was only checked for *this* caller.
        CacheControl cacheControl = book.getVisibility() == BookVisibility.PUBLIC
                ? CacheControl.maxAge(Duration.ofMinutes(10)).cachePublic()
                : CacheControl.noStore();
        return ResponseEntity.ok()
                .cacheControl(cacheControl)
                .contentType(MediaType.parseMediaType(book.getCoverImageContentType()))
                .body(book.getCoverImageData());
    }

    @GetMapping("/api/books/{id}/file")
    public ResponseEntity<byte[]> getFile(@PathVariable Long id) {
        BookFile file = bookService.getFileForView(id);
        Book book = file.getBook();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(book.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.inline().filename(book.getOriginalFilename()).build().toString())
                // Belt-and-suspenders alongside Spring Security's own default
                // nosniff header (SecurityConfig doesn't disable it): SH/SQL
                // uploads are served as text/plain (BookService.applyFile) and
                // must never be MIME-sniffed into anything a browser would
                // treat as executable/renderable content.
                .header(X_CONTENT_TYPE_OPTIONS, "nosniff")
                .body(file.getData());
    }

    @GetMapping("/api/books/{id}/download")
    public ResponseEntity<byte[]> download(@PathVariable Long id) {
        BookFile file = bookService.getFileForDownload(id);
        Book book = file.getBook();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(book.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        ContentDisposition.attachment().filename(book.getOriginalFilename()).build().toString())
                .header(X_CONTENT_TYPE_OPTIONS, "nosniff")
                .body(file.getData());
    }

    @GetMapping("/api/books/{id}/progress")
    public ResponseEntity<BookProgressResponse> getProgress(@PathVariable Long id) {
        return bookProgressService.get(id, requireCurrentUser())
                .map(ResponseEntity::ok)
                .orElseGet(() -> ResponseEntity.noContent().build());
    }

    @PutMapping("/api/books/{id}/progress")
    public BookProgressResponse putProgress(@PathVariable Long id, @Valid @RequestBody BookProgressRequest request) {
        return bookProgressService.upsert(id, requireCurrentUser(), request);
    }

    @GetMapping("/api/me/reading")
    public List<BookResponse> continueReading(@RequestParam(defaultValue = "6") int limit) {
        return bookProgressService.continueReading(requireCurrentUser(), Math.max(1, Math.min(limit, 20)));
    }

    // --- highlights (Phase 2, docs/09-book-highlights-phase2.md) ---

    @GetMapping("/api/books/{id}/highlights")
    public List<BookHighlightResponse> listHighlights(@PathVariable Long id) {
        return bookHighlightService.list(id, requireCurrentUser());
    }

    @PostMapping("/api/books/{id}/highlights")
    @ResponseStatus(HttpStatus.CREATED)
    public BookHighlightResponse createHighlight(@PathVariable Long id, @RequestBody BookHighlightRequest request) {
        return bookHighlightService.create(id, requireCurrentUser(), request);
    }

    @PutMapping("/api/books/{id}/highlights/{highlightId}")
    public BookHighlightResponse updateHighlight(@PathVariable Long id, @PathVariable Long highlightId,
                                                  @RequestBody BookHighlightUpdateRequest request) {
        return bookHighlightService.updateNote(id, highlightId, requireCurrentUser(), request);
    }

    @DeleteMapping("/api/books/{id}/highlights/{highlightId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteHighlight(@PathVariable Long id, @PathVariable Long highlightId) {
        bookHighlightService.delete(id, highlightId, requireCurrentUser());
    }

    @GetMapping("/api/me/highlights")
    public List<MyBookHighlightResponse> myHighlights(@RequestParam(defaultValue = "100") int limit) {
        return bookHighlightService.listForUser(requireCurrentUser(), Math.max(1, Math.min(limit, 200)));
    }

    /**
     * These routes are all `.authenticated()` in SecurityConfig, so Spring
     * Security already rejects an anonymous request before this runs — this
     * is a defensive fallback (e.g. a user deleted mid-session with a still-valid
     * JWT), not the primary gate.
     */
    private User requireCurrentUser() {
        User user = bookAccessService.currentUserOrNull();
        if (user == null) {
            throw new NotFoundException("USER_NOT_FOUND", "User not found");
        }
        return user;
    }
}
