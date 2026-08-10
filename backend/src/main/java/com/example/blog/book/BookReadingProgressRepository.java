package com.example.blog.book;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookReadingProgressRepository extends JpaRepository<BookReadingProgress, Long> {
    Optional<BookReadingProgress> findByBookIdAndUserId(Long bookId, Long userId);

    List<BookReadingProgress> findByUserIdAndBookIdIn(Long userId, List<Long> bookIds);

    void deleteByBookId(Long bookId);

    // "Continue reading" shelf: newest-updated, in-progress (1-99%) books for this user.
    @Query("""
            select p from BookReadingProgress p
            where p.user.id = :userId and p.percent > 0 and p.percent < 100
            order by p.updatedAt desc
            """)
    List<BookReadingProgress> findInProgressByUserId(@Param("userId") Long userId);
}
