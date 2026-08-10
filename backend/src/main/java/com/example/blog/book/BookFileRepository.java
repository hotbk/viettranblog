package com.example.blog.book;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookFileRepository extends JpaRepository<BookFile, Long> {
    Optional<BookFile> findByBookId(Long bookId);

    void deleteByBookId(Long bookId);
}
