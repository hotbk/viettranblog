package com.example.blog.tool;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ToolRepository extends JpaRepository<Tool, Long> {
    Optional<Tool> findBySlug(String slug);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, Long id);

    // includeDrafts=true is the admin listing (already ADMIN-gated by
    // SecurityConfig) and returns every status/visibility unfiltered — same
    // convention as PostRepository.search. The public path additionally
    // requires PUBLIC visibility, since Tool has no access-group system
    // (ToolVisibility's javadoc) to resolve a private row's readers with.
    @Query("""
            select t from Tool t
            where (:includeDrafts = true or (t.status = 'PUBLISHED' and t.visibility = 'PUBLIC'))
              and (cast(:category as String) is null or lower(t.category) = lower(cast(:category as String)))
              and (
                cast(:q as String) is null
                or lower(t.title) like lower(concat('%', cast(:q as String), '%'))
                or lower(t.excerpt) like lower(concat('%', cast(:q as String), '%'))
              )
            order by t.publishedAt desc nulls last, t.createdAt desc
            """)
    List<Tool> search(@Param("q") String q,
                       @Param("category") String category,
                       @Param("includeDrafts") boolean includeDrafts);
}
