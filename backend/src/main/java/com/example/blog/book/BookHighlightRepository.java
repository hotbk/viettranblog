package com.example.blog.book;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookHighlightRepository extends JpaRepository<BookHighlight, Long> {

    // Document order: TXT by startOffset, PDF by pageNumber then rects[0].y — the
    // latter isn't expressible in JPQL against a serialized TEXT column, so the
    // service sorts PDF rows in memory after this query (small per-book counts,
    // capped at 500 by the quota).
    @Query("""
            select h from BookHighlight h
            where h.book.id = :bookId and h.user.id = :userId
            order by h.startOffset asc nulls last, h.pageNumber asc nulls last, h.createdAt asc
            """)
    List<BookHighlight> findByBookIdAndUserId(@Param("bookId") Long bookId, @Param("userId") Long userId);

    List<BookHighlight> findByUserIdOrderByUpdatedAtDesc(Long userId);

    Optional<BookHighlight> findByIdAndUserId(Long id, Long userId);

    long countByBookIdAndUserId(Long bookId, Long userId);

    void deleteByBookId(Long bookId);

    void deleteByUserId(Long userId);
}
