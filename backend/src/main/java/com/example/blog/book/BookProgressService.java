package com.example.blog.book;

import com.example.blog.access.BookAccessService;
import com.example.blog.common.NotFoundException;
import com.example.blog.user.User;
import java.util.List;
import java.util.Optional;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * Server-side reading position for authenticated users only — anonymous
 * readers get localStorage persistence client-side instead (see
 * docs/08-book-library-module.md §1.3). Upsert is last-write-wins, no
 * cross-device merge. Callers resolve the current user the same way the rest
 * of the app does ({@code BookAccessService.currentUserOrNull()}) rather than
 * this service re-deriving it from a raw username.
 */
@Service
public class BookProgressService {

    private final BookRepository bookRepository;
    private final BookReadingProgressRepository progressRepository;
    private final BookAccessService bookAccessService;

    public BookProgressService(BookRepository bookRepository, BookReadingProgressRepository progressRepository,
                                BookAccessService bookAccessService) {
        this.bookRepository = bookRepository;
        this.progressRepository = progressRepository;
        this.bookAccessService = bookAccessService;
    }

    @Transactional(readOnly = true)
    public Optional<BookProgressResponse> get(Long bookId, User user) {
        Book book = requireReadableBook(bookId, user);
        return progressRepository.findByBookIdAndUserId(book.getId(), user.getId()).map(BookProgressResponse::from);
    }

    @Transactional
    public BookProgressResponse upsert(Long bookId, User user, BookProgressRequest request) {
        Book book = requireReadableBook(bookId, user);

        if (request.position() > request.total()) {
            throw new IllegalArgumentException("position must not exceed total");
        }
        ProgressUnit expected = book.getFileType() == BookFileType.PDF ? ProgressUnit.PAGE : ProgressUnit.PERCENT;
        if (request.unit() != expected) {
            throw new IllegalArgumentException("unit must be " + expected + " for a " + book.getFileType() + " book");
        }

        BookReadingProgress progress = progressRepository.findByBookIdAndUserId(book.getId(), user.getId())
                .orElseGet(BookReadingProgress::new);
        progress.setBook(book);
        progress.setUser(user);
        progress.setPosition(request.position());
        progress.setTotal(request.total());
        progress.setUnit(request.unit());
        progress.setPercent(request.total() <= 0 ? 0
                : Math.min(100, Math.round(request.position() * 100f / request.total())));
        return BookProgressResponse.from(progressRepository.save(progress));
    }

    /** The "continue reading" shelf — in-progress books, newest first, dropped if access was since revoked. */
    @Transactional(readOnly = true)
    public List<BookResponse> continueReading(User user, int limit) {
        return progressRepository.findInProgressByUserId(user.getId()).stream()
                .filter(p -> bookAccessService.canRead(user, p.getBook()))
                .limit(limit)
                .map(p -> BookResponse.from(p.getBook(), BookResponse.ReadProgress.from(p)))
                .toList();
    }

    private Book requireReadableBook(Long bookId, User user) {
        Book book = bookRepository.findById(bookId)
                .orElseThrow(() -> new NotFoundException("BOOK_NOT_FOUND", "Book not found"));
        bookAccessService.requireRead(user, book);
        return book;
    }
}
