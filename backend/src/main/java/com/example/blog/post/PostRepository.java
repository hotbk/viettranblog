package com.example.blog.post;

import com.example.blog.common.ContentLanguage;
import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface PostRepository extends JpaRepository<Post, Long> {
    Optional<Post> findBySlug(String slug);

    // Dual-language content (docs/10-multilingual-content.md §1).
    List<Post> findByTranslationGroupId(long translationGroupId);

    List<Post> findByTranslationGroupIdIn(List<Long> translationGroupIds);

    boolean existsByTranslationGroupIdAndLanguage(long translationGroupId, ContentLanguage language);

    // Fully public + published only — used for the sitemap. Deliberately excludes PRIVATE posts
    // (even ones with a public teaser) since listing a gated URL in a public sitemap would defeat
    // the point of gating it.
    List<Post> findByStatusAndVisibility(PostStatus status, PostVisibility visibility);

    boolean existsBySlug(String slug);

    boolean existsBySlugAndIdNot(String slug, Long id);

    @Query("""
            select p from Post p
            where (:includeDrafts = true or p.status = 'PUBLISHED')
              and (cast(:category as String) is null or lower(p.category) = lower(cast(:category as String)))
              and (:language is null or p.language = :language)
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
                      @Param("includeDrafts") boolean includeDrafts,
                      @Param("language") ContentLanguage language);

    @Modifying
    @Query("UPDATE Post p SET p.viewCount = p.viewCount + 1 WHERE p.slug = :slug AND p.status = 'PUBLISHED'")
    int incrementViewCount(@Param("slug") String slug);

    // Candidate pool for the "related posts" widget: recent published posts,
    // excluding the post itself. Scoring by category/tag overlap and access
    // filtering happen in PostService — kept out of JPQL since tags are a
    // comma-separated string, not a queryable collection.
    // Related-posts candidate pool, scoped to the source post's own language
    // (docs/10-multilingual-content.md §7.1) — a Vietnamese reader must not be
    // offered English suggestions. Translation-group siblings are excluded in
    // PostService (that's what the switcher is for, not this widget).
    @Query("""
            select p from Post p
            where p.status = 'PUBLISHED' and p.id <> :excludeId and p.language = :language
            order by p.publishedAt desc nulls last, p.createdAt desc
            """)
    List<Post> findRecentPublishedExcluding(@Param("excludeId") Long excludeId,
                                             @Param("language") ContentLanguage language,
                                             Pageable pageable);
}
