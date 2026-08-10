package com.example.blog.book;

import com.example.blog.access.BookAccessGroupRepository;
import com.example.blog.access.BookAccessService;
import com.example.blog.access.BookUserPermissionRepository;
import com.example.blog.common.NotFoundException;
import com.example.blog.user.User;
import java.io.IOException;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Book CRUD, listing, and the gated file/cover-image/download reads. Upload
 * validation (allowlist + magic bytes + size cap) and the four-table delete
 * cleanup are the two places most likely to regress — see R5/R9 in
 * docs/08-book-library-module.md.
 */
@Service
public class BookService {

    // Documents/books run larger than post attachments but still capped well
    // below the video feature's 200MB — see docs/08-book-library-module.md §1.5.
    static final long MAX_BOOK_SIZE = 50L * 1024 * 1024; // 50 MB
    private static final long MAX_COVER_IMAGE_SIZE = 2L * 1024 * 1024; // 2 MB
    private static final Set<String> ALLOWED_COVER_TYPES = Set.of("image/jpeg", "image/png", "image/webp");

    private static final Map<String, BookFileType> ALLOWED_BOOK_TYPES = Map.of(
            "application/pdf", BookFileType.PDF,
            "text/plain", BookFileType.TXT
    );

    private final BookRepository bookRepository;
    private final BookFileRepository bookFileRepository;
    private final BookReadingProgressRepository progressRepository;
    private final BookHighlightRepository bookHighlightRepository;
    private final BookAccessService bookAccessService;
    private final BookAccessGroupRepository bookAccessGroupRepository;
    private final BookUserPermissionRepository bookUserPermissionRepository;

    public BookService(BookRepository bookRepository, BookFileRepository bookFileRepository,
                        BookReadingProgressRepository progressRepository,
                        BookHighlightRepository bookHighlightRepository, BookAccessService bookAccessService,
                        BookAccessGroupRepository bookAccessGroupRepository,
                        BookUserPermissionRepository bookUserPermissionRepository) {
        this.bookRepository = bookRepository;
        this.bookFileRepository = bookFileRepository;
        this.progressRepository = progressRepository;
        this.bookHighlightRepository = bookHighlightRepository;
        this.bookAccessService = bookAccessService;
        this.bookAccessGroupRepository = bookAccessGroupRepository;
        this.bookUserPermissionRepository = bookUserPermissionRepository;
    }

    /**
     * Public/listing search. When includeDrafts is true this is the admin "all
     * books" listing (already ADMIN-gated by SecurityConfig) and shows
     * everything unfiltered. Only the public path applies visibility filtering
     * and teaser/omit logic — same shape as PostService.search.
     */
    @Transactional(readOnly = true)
    public List<BookResponse> search(String q, String category, BookFileType fileType, boolean includeDrafts) {
        String normalizedQuery = blankToNull(q);
        String normalizedCategory = blankToNull(category);
        List<Book> results = bookRepository.search(normalizedQuery, normalizedCategory, fileType, includeDrafts);

        if (includeDrafts) {
            Map<Long, Integer> groupCounts = accessGroupCounts(results);
            return results.stream()
                    .map(b -> BookResponse.from(b, null, groupCounts.get(b.getId())))
                    .toList();
        }

        User currentUser = bookAccessService.currentUserOrNull();
        Set<Long> accessibleIds = bookAccessService.resolveAccessibleBookIds(currentUser, results);
        Map<Long, BookResponse.ReadProgress> progressByBook = progressByBookId(currentUser, results);
        return results.stream()
                .<BookResponse>mapMulti((book, consumer) -> {
                    if (accessibleIds.contains(book.getId())) {
                        consumer.accept(BookResponse.from(book, progressByBook.get(book.getId())));
                    } else if (book.getMetadataVisibility() == BookMetadataVisibility.PUBLIC_METADATA) {
                        consumer.accept(BookResponse.teaser(book));
                    }
                    // else: AUTHORIZED_ONLY and inaccessible -> omit entirely, never sent to the client
                })
                .toList();
    }

    @Transactional(readOnly = true)
    public BookResponse findBySlug(String slug) {
        Book book = bookRepository.findBySlug(slug)
                .filter(b -> b.getStatus() == BookStatus.PUBLISHED)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        User currentUser = bookAccessService.currentUserOrNull();
        if (book.getVisibility() == BookVisibility.PRIVATE
                && book.getMetadataVisibility() == BookMetadataVisibility.AUTHORIZED_ONLY
                && !bookAccessService.canRead(currentUser, book)) {
            // Don't confirm existence the listing deliberately hid.
            throw new NotFoundException("BOOK_NOT_FOUND", "Book not found");
        }
        bookAccessService.requireRead(currentUser, book);
        BookResponse.ReadProgress progress = currentUser == null ? null
                : progressRepository.findByBookIdAndUserId(book.getId(), currentUser.getId())
                        .map(BookResponse.ReadProgress::from)
                        .orElse(null);
        return BookResponse.from(book, progress);
    }

    @Transactional(readOnly = true)
    public BookResponse getAdminDetail(Long id) {
        Book book = bookRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        return BookResponse.from(book, null, accessGroupCounts(List.of(book)).get(id));
    }

    @Transactional
    public BookResponse create(BookRequest request, MultipartFile file, MultipartFile coverImage) {
        requireNonBlank(request.title(), "Title is required");
        String slug = requireNonBlank(request.slug(), "Slug is required");
        if (bookRepository.existsBySlug(slug)) {
            throw new IllegalArgumentException("Slug already exists");
        }
        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Book file is required");
        }
        Book book = new Book();
        applyRequest(book, request);
        applyFile(book, file);
        if (coverImage != null && !coverImage.isEmpty()) {
            applyCoverImage(book, coverImage);
        }
        Book saved = bookRepository.save(book);
        storeFileBytes(saved, file);
        return BookResponse.from(saved, null);
    }

    @Transactional
    public BookResponse update(Long id, BookRequest request, MultipartFile file, MultipartFile coverImage,
                                boolean removeCoverImage) {
        Book book = bookRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        requireNonBlank(request.title(), "Title is required");
        String newSlug = requireNonBlank(request.slug(), "Slug is required");
        if (!book.getSlug().equals(newSlug) && bookRepository.existsBySlugAndIdNot(newSlug, id)) {
            throw new IllegalArgumentException("Slug already exists");
        }
        applyRequest(book, request);
        if (removeCoverImage) {
            clearCoverImage(book);
        } else if (coverImage != null && !coverImage.isEmpty()) {
            applyCoverImage(book, coverImage);
        }
        if (file != null && !file.isEmpty()) {
            applyFile(book, file);
            // Bump file_version so existing highlights are flagged `stale` instead
            // of pointing at the wrong place in the new file — deliberately NOT
            // deleted like reading progress below (a highlight's note is
            // user-authored content; see docs/09-book-highlights-phase2.md §2.3).
            book.setFileVersion(book.getFileVersion() + 1);
            Book saved = bookRepository.saveAndFlush(book);
            storeFileBytes(saved, file);
            // A replaced file invalidates any saved page/percent positions from
            // the old edition — see R12 in docs/08-book-library-module.md.
            progressRepository.deleteByBookId(id);
            return BookResponse.from(saved, null);
        }
        return BookResponse.from(bookRepository.saveAndFlush(book), null);
    }

    @Transactional
    public BookResponse updateStatus(Long id, BookStatus status) {
        Book book = bookRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        book.setStatus(status);
        return BookResponse.from(bookRepository.saveAndFlush(book), null);
    }

    @Transactional
    public void delete(Long id) {
        if (!bookRepository.existsById(id)) {
            throw new NotFoundException("BOOK_NOT_FOUND", "Book not found");
        }
        // Five dependent tables, none DB-cascaded (nothing in this codebase uses
        // ON DELETE CASCADE) — ordered cleanup is required or this 500s with a FK
        // violation, the same bug class already shipped once for post_attachments.
        bookHighlightRepository.deleteByBookId(id);
        progressRepository.deleteByBookId(id);
        bookAccessGroupRepository.deleteByBookId(id);
        bookUserPermissionRepository.deleteByBookId(id);
        bookFileRepository.deleteByBookId(id);
        bookRepository.deleteById(id);
    }

    @Transactional(readOnly = true)
    public Book getCoverImageBook(Long id) {
        Book book = bookRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        if (book.getCoverImageData() == null || book.getCoverImageData().length == 0) {
            throw new NotFoundException("COVER_IMAGE_NOT_FOUND", "Cover image not found");
        }
        if (!bookAccessService.canRead(bookAccessService.currentUserOrNull(), book)) {
            throw new NotFoundException("COVER_IMAGE_NOT_FOUND", "Cover image not found");
        }
        return book;
    }

    /** Gated read of the book's bytes — used by both /file (inline) and /download. */
    @Transactional(readOnly = true)
    public BookFile getFileForView(Long id) {
        Book book = bookRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        if (!bookAccessService.canRead(bookAccessService.currentUserOrNull(), book)) {
            throw new NotFoundException("BOOK_NOT_FOUND", "Book not found");
        }
        return bookFileRepository.findByBookId(id)
                .orElseThrow(() -> new NotFoundException("BOOK_FILE_NOT_FOUND", "Book file not found"));
    }

    /** Same gate as getFileForView, plus the downloadable flag. */
    @Transactional(readOnly = true)
    public BookFile getFileForDownload(Long id) {
        Book book = bookRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        if (!bookAccessService.canRead(bookAccessService.currentUserOrNull(), book)) {
            throw new NotFoundException("BOOK_NOT_FOUND", "Book not found");
        }
        if (!book.isDownloadable()) {
            throw new BookNotDownloadableException();
        }
        return bookFileRepository.findByBookId(id)
                .orElseThrow(() -> new NotFoundException("BOOK_FILE_NOT_FOUND", "Book file not found"));
    }

    // --- helpers ---

    private Map<Long, BookResponse.ReadProgress> progressByBookId(User currentUser, List<Book> books) {
        if (currentUser == null || books.isEmpty()) {
            return Map.of();
        }
        List<Long> bookIds = books.stream().map(Book::getId).toList();
        Map<Long, BookResponse.ReadProgress> result = new HashMap<>();
        progressRepository.findByUserIdAndBookIdIn(currentUser.getId(), bookIds)
                .forEach(p -> result.put(p.getBook().getId(), BookResponse.ReadProgress.from(p)));
        return result;
    }

    private Map<Long, Integer> accessGroupCounts(List<Book> books) {
        List<Long> privateIds = books.stream()
                .filter(b -> b.getVisibility() == BookVisibility.PRIVATE)
                .map(Book::getId)
                .toList();
        if (privateIds.isEmpty()) {
            return Map.of();
        }
        Map<Long, Integer> counts = new HashMap<>();
        bookAccessGroupRepository.findByBookIdIn(privateIds).forEach(bag ->
                counts.merge(bag.getBook().getId(), 1, Integer::sum));
        return counts;
    }

    private static void applyRequest(Book book, BookRequest request) {
        book.setTitle(request.title().trim());
        book.setSlug(request.slug().trim());
        book.setAuthor(blankToNull(request.author()));
        book.setDescription(request.description());
        book.setCategory(blankToNull(request.category()));
        book.setStatus(request.status());
        book.setVisibility(request.visibility() != null ? request.visibility() : BookVisibility.PUBLIC);
        book.setMetadataVisibility(
                request.metadataVisibility() != null
                        ? request.metadataVisibility()
                        : BookMetadataVisibility.PUBLIC_METADATA);
        book.setDownloadable(request.downloadable());
    }

    private static void applyFile(Book book, MultipartFile file) {
        String contentType = file.getContentType();
        BookFileType type = contentType == null ? null : ALLOWED_BOOK_TYPES.get(contentType);
        if (type == null) {
            throw new IllegalArgumentException("Invalid book file type. Allowed types: PDF, TXT");
        }
        if (file.getSize() > MAX_BOOK_SIZE) {
            throw new IllegalArgumentException("Book file exceeds maximum allowed size of 50 MB");
        }
        byte[] header;
        try {
            header = file.getBytes();
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read book file: " + e.getMessage());
        }
        validateMagicBytes(type, header);
        book.setFileType(type);
        book.setContentType(contentType);
        book.setOriginalFilename(sanitizeFilename(file.getOriginalFilename()));
        book.setFileSize(file.getSize());
    }

    private void storeFileBytes(Book book, MultipartFile file) {
        try {
            BookFile bookFile = bookFileRepository.findByBookId(book.getId()).orElseGet(BookFile::new);
            bookFile.setBook(book);
            bookFile.setData(file.getBytes());
            bookFileRepository.save(bookFile);
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read book file: " + e.getMessage());
        }
    }

    /**
     * Client-supplied Content-Type is trusted for the allowlist check above,
     * but not for anything else — a renamed binary claiming application/pdf is
     * a cheap thing to catch (R9 in docs/08-book-library-module.md).
     */
    private static void validateMagicBytes(BookFileType type, byte[] data) {
        if (type == BookFileType.PDF) {
            byte[] sig = "%PDF-".getBytes();
            if (data.length < sig.length || !startsWith(data, sig)) {
                throw new IllegalArgumentException("File does not look like a valid PDF");
            }
        } else {
            // TXT: reject anything that looks binary — a NUL byte in the first
            // few KB is not something a real text file contains.
            int scanLen = Math.min(data.length, 8000);
            for (int i = 0; i < scanLen; i++) {
                if (data[i] == 0) {
                    throw new IllegalArgumentException("File does not look like a valid text file");
                }
            }
        }
    }

    private static boolean startsWith(byte[] data, byte[] prefix) {
        for (int i = 0; i < prefix.length; i++) {
            if (data[i] != prefix[i]) {
                return false;
            }
        }
        return true;
    }

    private static void applyCoverImage(Book book, MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_COVER_TYPES.contains(contentType)) {
            throw new IllegalArgumentException(
                    "Invalid cover image type. Allowed types: image/jpeg, image/png, image/webp");
        }
        if (file.getSize() > MAX_COVER_IMAGE_SIZE) {
            throw new IllegalArgumentException("Cover image exceeds maximum allowed size of 2 MB");
        }
        try {
            book.setCoverImageData(file.getBytes());
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read cover image: " + e.getMessage());
        }
        book.setCoverImageContentType(contentType);
        book.setCoverImageSize(file.getSize());
    }

    private static void clearCoverImage(Book book) {
        book.setCoverImageData(null);
        book.setCoverImageContentType(null);
        book.setCoverImageSize(null);
    }

    private static String sanitizeFilename(String filename) {
        if (filename == null) {
            return "book";
        }
        String sanitized = filename.replaceAll("[/\\\\]", "_");
        if (sanitized.length() > 255) {
            sanitized = sanitized.substring(sanitized.length() - 255);
        }
        return sanitized;
    }

    private static String blankToNull(String value) {
        return value == null || value.isBlank() ? null : value.trim();
    }

    /**
     * Trims and rejects a blank title/slug. Found live: the multipart
     * `@RequestParam` fields on {@link AdminBookController} bypass Bean
     * Validation entirely (no `@Valid` on a request body to trigger it), and
     * the old code checked slug uniqueness against the *untrimmed* value while
     * storing the *trimmed* one — a whitespace-only slug (passes HTML5
     * `required`, since a single space has non-zero length) sailed through as
     * "unique" and was then stored as `""`, producing an unroutable
     * `/library/` detail link. Same latent gap likely exists in
     * `PostService`/`PostRequest` (manually-constructed from `@RequestParam`
     * too) — not fixed here, out of scope for this feature.
     */
    private static String requireNonBlank(String value, String message) {
        String trimmed = value == null ? "" : value.trim();
        if (trimmed.isBlank()) {
            throw new IllegalArgumentException(message);
        }
        return trimmed;
    }
}
