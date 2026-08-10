package com.example.blog.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookUserPermissionRepository extends JpaRepository<BookUserPermission, Long> {
    List<BookUserPermission> findByBookId(Long bookId);
    boolean existsByBookIdAndUserId(Long bookId, Long userId);
    List<BookUserPermission> findByUserIdAndBookIdIn(Long userId, List<Long> bookIds);
    void deleteByBookId(Long bookId);
    void deleteByBookIdAndUserId(Long bookId, Long userId);
    List<BookUserPermission> findByUserId(Long userId);
}
