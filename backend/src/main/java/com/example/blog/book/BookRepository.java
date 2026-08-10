package com.example.blog.book;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface BookRepository extends JpaRepository<Book, Long> {
    Optional<Book> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, Long id);

    @Query("""
            select b from Book b
            where (:includeDrafts = true or b.status = 'PUBLISHED')
              and (cast(:category as String) is null or lower(b.category) = lower(cast(:category as String)))
              and (:fileType is null or b.fileType = :fileType)
              and (
                cast(:q as String) is null
                or lower(b.title) like lower(concat('%', cast(:q as String), '%'))
                or lower(b.author) like lower(concat('%', cast(:q as String), '%'))
                or lower(b.description) like lower(concat('%', cast(:q as String), '%'))
              )
            order by b.publishedAt desc nulls last, b.createdAt desc
            """)
    List<Book> search(@Param("q") String q,
                       @Param("category") String category,
                       @Param("fileType") BookFileType fileType,
                       @Param("includeDrafts") boolean includeDrafts);
}
