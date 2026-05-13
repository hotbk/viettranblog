package com.example.blog.post;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {
    Optional<Post> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, Long id);

    @Query("""
            select p from Post p
            where (:includeDrafts = true or p.status = 'PUBLISHED')
              and (cast(:category as String) is null or lower(p.category) = lower(cast(:category as String)))
              and (
                cast(:q as String) is null
                or lower(p.title) like lower(concat('%', cast(:q as String), '%'))
                or lower(p.excerpt) like lower(concat('%', cast(:q as String), '%'))
                or lower(p.content) like lower(concat('%', cast(:q as String), '%'))
              )
            order by p.publishedAt desc nulls last, p.createdAt desc
            """)
    List<Post> search(@Param("q") String q,
                      @Param("category") String category,
                      @Param("includeDrafts") boolean includeDrafts);

    @Modifying
    @Query("UPDATE Post p SET p.viewCount = p.viewCount + 1 WHERE p.slug = :slug AND p.status = 'PUBLISHED'")
    int incrementViewCount(@Param("slug") String slug);
}
