package com.example.blog.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface BookAccessGroupRepository extends JpaRepository<BookAccessGroup, Long> {
    List<BookAccessGroup> findByBookId(Long bookId);
    List<BookAccessGroup> findByBookIdIn(List<Long> bookIds);
    void deleteByBookId(Long bookId);
    void deleteByAccessGroupId(Long accessGroupId);
    long countByAccessGroupId(Long accessGroupId);
}
