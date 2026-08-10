package com.example.blog.series;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.blog.common.ContentLanguage;
import com.example.blog.post.PostMetadataVisibility;
import com.example.blog.post.PostRequest;
import com.example.blog.post.PostResponse;
import com.example.blog.post.PostService;
import com.example.blog.post.PostStatus;
import com.example.blog.post.PostVisibility;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * A series is single-language, enforced by a write-time guard rather than a
 * schema change (docs/10-multilingual-content.md §7.4) — a mixed-language
 * series would produce a prev/next link that jumps language mid-read.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class SeriesLanguageGuardTest {

    @Autowired private PostService postService;
    @Autowired private SeriesService seriesService;

    private PostResponse createPost(String slug, ContentLanguage language) {
        return postService.create(new PostRequest(
                "Series lang " + slug, slug, "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                language, null
        ), null);
    }

    @Test
    void addingPostsOfDifferentLanguagesToOneSeriesIsRejected() {
        PostResponse viPost = createPost("series-lang-vi", ContentLanguage.VI);
        PostResponse enPost = createPost("series-lang-en", ContentLanguage.EN);

        SeriesDetailResponse series = seriesService.create(new SeriesRequest(
                "Language Guard Series", "series-lang-guard", "desc", PostStatus.PUBLISHED));

        assertThatThrownBy(() -> seriesService.setPostOrder(series.id(),
                new SeriesPostsRequest(List.of(viPost.id(), enPost.id()))))
                .isInstanceOf(IllegalArgumentException.class)
                .hasMessage("SERIES_LANGUAGE_MISMATCH");
    }

    @Test
    void addingPostsOfTheSameLanguageSucceeds() {
        PostResponse first = createPost("series-lang-vi-a", ContentLanguage.VI);
        PostResponse second = createPost("series-lang-vi-b", ContentLanguage.VI);

        SeriesDetailResponse series = seriesService.create(new SeriesRequest(
                "Language Guard Series OK", "series-lang-guard-ok", "desc", PostStatus.PUBLISHED));

        SeriesDetailResponse updated = seriesService.setPostOrder(series.id(),
                new SeriesPostsRequest(List.of(first.id(), second.id())));

        assertThat(updated.postCount()).isEqualTo(2);
    }
}
