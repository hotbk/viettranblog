package com.example.blog.post;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {
    Optional<Post> findBySlug(String slug);

    boolean existsBySlug(String slug);

    @Query("""
            select p from Post p
            where (:includeDrafts = true or p.status = 'PUBLISHED')
              and (:category is null or lower(p.category) = lower(:category))
              and (
                :q is null
                or lower(p.title) like lower(concat('%', :q, '%'))
                or lower(p.excerpt) like lower(concat('%', :q, '%'))
                or lower(p.content) like lower(concat('%', :q, '%'))
              )
            order by p.publishedAt desc nulls last, p.createdAt desc
            """)
    List<Post> search(@Param("q") String q,
                      @Param("category") String category,
                      @Param("includeDrafts") boolean includeDrafts);
}
