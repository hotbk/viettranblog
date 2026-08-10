package com.example.blog.book;

import com.example.blog.access.BookAccessService;
import com.example.blog.common.NotFoundException;
import com.example.blog.user.User;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.Comparator;
import java.util.List;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * A reader's private highlights — every method goes through
 * {@link BookAccessService#requireRead} first (a highlight requires read
 * access to the book), and every lookup is scoped to the current user (no
 * sharing, no admin viewer — see docs/09-book-highlights-phase2.md §4.2).
 */
@Service
public class BookHighlightService {

    static final int MAX_TEXT_LENGTH = 2000;
    static final int MAX_NOTE_LENGTH = 2000;
    static final int MAX_RECTS = 100;
    static final long MAX_HIGHLIGHTS_PER_BOOK = 500;

    private final BookHighlightRepository highlightRepository;
    private final BookRepository bookRepository;
    private final BookAccessService bookAccessService;
    private final ObjectMapper objectMapper;

    public BookHighlightService(BookHighlightRepository highlightRepository, BookRepository bookRepository,
                                 BookAccessService bookAccessService, ObjectMapper objectMapper) {
        this.highlightRepository = highlightRepository;
        this.bookRepository = bookRepository;
        this.bookAccessService = bookAccessService;
        this.objectMapper = objectMapper;
    }

    @Transactional(readOnly = true)
    public List<BookHighlightResponse> list(Long bookId, User user) {
        Book book = requireReadableBook(bookId, user);
        List<BookHighlightResponse> responses = highlightRepository.findByBookIdAndUserId(bookId, user.getId())
                .stream()
                .map(this::toResponse)
                .toList();
        if (book.getFileType() != BookFileType.PDF) {
            return responses;
        }
        // The repository query can't express "sort by first rect's y" against a
        // serialized TEXT column, so refine the per-page ordering here — small
        // per-book counts (capped at 500), cheap to sort in memory.
        return responses.stream()
                .sorted(Comparator.comparingInt(BookHighlightResponse::pageNumber)
                        .thenComparingDouble(r -> r.rects() != null && !r.rects().isEmpty() ? r.rects().get(0).y() : 0))
                .toList();
    }

    @Transactional
    public BookHighlightResponse create(Long bookId, User user, BookHighlightRequest request) {
        Book book = requireReadableBook(bookId, user);
        validateAnchor(book, request);
        String text = requireNonBlankAndCapped(request.text(), MAX_TEXT_LENGTH, "HIGHLIGHT_TEXT_TOO_LONG");
        String note = normalizeNote(request.note());

        if (highlightRepository.countByBookIdAndUserId(bookId, user.getId()) >= MAX_HIGHLIGHTS_PER_BOOK) {
            throw new IllegalArgumentException("HIGHLIGHT_LIMIT_REACHED");
        }

        BookHighlight highlight = new BookHighlight();
        highlight.setBook(book);
        highlight.setUser(user);
        highlight.setFileVersion(book.getFileVersion());
        highlight.setAnchorType(request.anchorType());
        highlight.setStartOffset(request.startOffset());
        highlight.setEndOffset(request.endOffset());
        highlight.setPageNumber(request.pageNumber());
        highlight.setRects(request.rects() == null ? null : toJson(request.rects()));
        highlight.setColor(request.color() != null ? request.color() : HighlightColor.YELLOW);
        highlight.setText(text);
        highlight.setNote(note);

        return toResponse(highlightRepository.save(highlight));
    }

    @Transactional
    public BookHighlightResponse updateNote(Long bookId, Long highlightId, User user, BookHighlightUpdateRequest request) {
        BookHighlight highlight = requireOwnedHighlight(bookId, highlightId, user);
        highlight.setNote(normalizeNote(request.note()));
        return toResponse(highlightRepository.save(highlight));
    }

    @Transactional
    public void delete(Long bookId, Long highlightId, User user) {
        BookHighlight highlight = requireOwnedHighlight(bookId, highlightId, user);
        highlightRepository.delete(highlight);
    }

    /** The cross-book shelf — access-filtered same as continueReading, so a revoked grant hides the highlights too. */
    @Transactional(readOnly = true)
    public List<MyBookHighlightResponse> listForUser(User user, int limit) {
        return highlightRepository.findByUserIdOrderByUpdatedAtDesc(user.getId()).stream()
                .filter(h -> h.getBook().getStatus() == BookStatus.PUBLISHED)
                .filter(h -> bookAccessService.canRead(user, h.getBook()))
                .limit(limit)
                .map(h -> new MyBookHighlightResponse(
                        toResponse(h), h.getBook().getTitle(), h.getBook().getSlug(), h.getBook().getFileType()))
                .toList();
    }

    // --- helpers ---

    private Book requireReadableBook(Long bookId, User user) {
        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        bookAccessService.requireRead(user, book);
        return book;
    }

    /** Not found, wrong owner, and wrong book all collapse to the same 404 — no oracle for probing another user's rows. */
    private BookHighlight requireOwnedHighlight(Long bookId, Long highlightId, User user) {
        BookHighlight highlight = highlightRepository.findByIdAndUserId(highlightId, user.getId())
                .orElseThrow(() -> new NotFoundException("HIGHLIGHT_NOT_FOUND", "Highlight not found"));
        if (!highlight.getBook().getId().equals(bookId)) {
            throw new NotFoundException("HIGHLIGHT_NOT_FOUND", "Highlight not found");
        }
        return highlight;
    }

    private static void validateAnchor(Book book, BookHighlightRequest request) {
        HighlightAnchorType expected = book.getFileType() == BookFileType.PDF
                ? HighlightAnchorType.PDF_RECTS
                : HighlightAnchorType.TXT_OFFSET;
        if (request.anchorType() != expected) {
            throw new IllegalArgumentException("INVALID_HIGHLIGHT_ANCHOR");
        }
        if (expected == HighlightAnchorType.TXT_OFFSET) {
            Integer start = request.startOffset();
            Integer end = request.endOffset();
            if (start == null || end == null || start < 0 || end <= start) {
                throw new IllegalArgumentException("INVALID_HIGHLIGHT_ANCHOR");
            }
            if (request.pageNumber() != null || request.rects() != null) {
                throw new IllegalArgumentException("INVALID_HIGHLIGHT_ANCHOR");
            }
        } else {
            Integer page = request.pageNumber();
            List<BookHighlightRequest.Rect> rects = request.rects();
            if (page == null || page < 1) {
                throw new IllegalArgumentException("INVALID_HIGHLIGHT_ANCHOR");
            }
            if (rects == null || rects.isEmpty() || rects.size() > MAX_RECTS) {
                throw new IllegalArgumentException("INVALID_HIGHLIGHT_ANCHOR");
            }
            for (BookHighlightRequest.Rect r : rects) {
                if (!inUnitRange(r.x()) || !inUnitRange(r.y()) || !inUnitRange(r.w()) || !inUnitRange(r.h())) {
                    throw new IllegalArgumentException("INVALID_HIGHLIGHT_ANCHOR");
                }
            }
            if (request.startOffset() != null || request.endOffset() != null) {
                throw new IllegalArgumentException("INVALID_HIGHLIGHT_ANCHOR");
            }
        }
    }

    private static boolean inUnitRange(double v) {
        return v >= 0.0 && v <= 1.0;
    }

    /**
     * Not trimmed — the TXT re-anchor invariant (`text.slice(start,end) === highlight.text`,
     * see docs/09-book-highlights-phase2.md §2.1) depends on the stored snippet
     * matching the decoded text byte-for-byte, including any surrounding whitespace
     * the browser's Range API included.
     */
    private static String requireNonBlankAndCapped(String value, int maxLen, String tooLongCode) {
        if (value == null || value.isBlank()) {
            throw new IllegalArgumentException("Highlight text is required");
        }
        if (value.length() > maxLen) {
            throw new IllegalArgumentException(tooLongCode);
        }
        return value;
    }

    private static String normalizeNote(String note) {
        if (note == null) {
            return null;
        }
        String trimmed = note.trim();
        if (trimmed.isEmpty()) {
            return null;
        }
        if (trimmed.length() > MAX_NOTE_LENGTH) {
            throw new IllegalArgumentException("HIGHLIGHT_NOTE_TOO_LONG");
        }
        return trimmed;
    }

    private String toJson(List<BookHighlightRequest.Rect> rects) {
        try {
            return objectMapper.writeValueAsString(rects);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("INVALID_HIGHLIGHT_ANCHOR");
        }
    }

    private List<BookHighlightRequest.Rect> parseRects(String json) {
        if (json == null) {
            return null;
        }
        try {
            return objectMapper.readValue(json, new TypeReference<List<BookHighlightRequest.Rect>>() { });
        } catch (JsonProcessingException e) {
            return List.of();
        }
    }

    private BookHighlightResponse toResponse(BookHighlight h) {
        List<BookHighlightRequest.Rect> rects = h.getAnchorType() == HighlightAnchorType.PDF_RECTS
                ? parseRects(h.getRects())
                : null;
        return BookHighlightResponse.from(h, rects);
    }
}
