package com.example.blog.post;

import static org.assertj.core.api.Assertions.assertThat;

import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PostServiceTest {
    @Autowired
    private PostService postService;

    @Test
    void searchExcludesDraftsByDefault() {
        postService.create(new PostRequest(
                "Published Test",
                "published-test",
                "Published excerpt",
                "Published content",
                "Test",
                List.of("published"),
                PostStatus.PUBLISHED,
                PostVisibility.PUBLIC,
                null
        , null, null), null);

        postService.create(new PostRequest(
                "Draft Test",
                "draft-test",
                "Draft excerpt",
                "Draft content",
                "Test",
                List.of("draft"),
                PostStatus.DRAFT,
                PostVisibility.PUBLIC,
                null
        , null, null), null);

        List<PostResponse> result = postService.search("Test", null, false, null);

        assertThat(result).extracting(PostResponse::slug).contains("published-test");
        assertThat(result).extracting(PostResponse::slug).doesNotContain("draft-test");
    }

    @Test
    void updateStatusTogglesBetweenDraftAndPublished() {
        PostResponse created = postService.create(new PostRequest(
                "Toggle Test",
                "toggle-test",
                "Toggle excerpt",
                "Toggle content",
                "Test",
                List.of("toggle"),
                PostStatus.DRAFT,
                PostVisibility.PUBLIC,
                null
        , null, null), null);

        PostResponse published = postService.updateStatus(created.id(), PostStatus.PUBLISHED);
        assertThat(published.status()).isEqualTo(PostStatus.PUBLISHED);
        assertThat(published.publishedAt()).isNotNull();

        PostResponse backToDraft = postService.updateStatus(created.id(), PostStatus.DRAFT);
        assertThat(backToDraft.status()).isEqualTo(PostStatus.DRAFT);
    }

    @Test
    void findRelatedRanksCategoryMatchAboveTagOnlyMatchAndExcludesSelfAndDrafts() {
        postService.create(new PostRequest(
                "Related Source", "related-source", "Source excerpt", "Source content",
                "Java", List.of("spring", "jpa"),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, null
        , null, null), null);

        // Same category -> highest score
        postService.create(new PostRequest(
                "Related Same Category", "related-same-category", "excerpt", "content",
                "Java", List.of("unrelated"),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, null
        , null, null), null);

        // Different category but shares one tag -> lower score, still related
        postService.create(new PostRequest(
                "Related Shared Tag", "related-shared-tag", "excerpt", "content",
                "DevOps", List.of("jpa"),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, null
        , null, null), null);

        // No category or tag overlap -> not related
        postService.create(new PostRequest(
                "Related Unmatched", "related-unmatched", "excerpt", "content",
                "Cooking", List.of("recipes"),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, null
        , null, null), null);

        // Same category but still a draft -> must never appear
        postService.create(new PostRequest(
                "Related Draft Same Category", "related-draft-same-category", "excerpt", "content",
                "Java", List.of(),
                PostStatus.DRAFT, PostVisibility.PUBLIC, null
        , null, null), null);

        List<RelatedPostResponse> related = postService.findRelated("related-source", null);

        assertThat(related).extracting(RelatedPostResponse::slug)
                .doesNotContain("related-source", "related-unmatched", "related-draft-same-category");
        assertThat(related).extracting(RelatedPostResponse::slug)
                .containsExactly("related-same-category", "related-shared-tag");
    }

    @Test
    void findRelatedOmitsInaccessiblePrivatePosts() {
        postService.create(new PostRequest(
                "Related Private Source", "related-private-source", "excerpt", "content",
                "Security", List.of("auth"),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, null
        , null, null), null);

        postService.create(new PostRequest(
                "Related Private Candidate", "related-private-candidate", "excerpt", "content",
                "Security", List.of("auth"),
                PostStatus.PUBLISHED, PostVisibility.PRIVATE, PostMetadataVisibility.PUBLIC_METADATA
        , null, null), null);

        List<RelatedPostResponse> related = postService.findRelated("related-private-source", null);

        assertThat(related).extracting(RelatedPostResponse::slug).doesNotContain("related-private-candidate");
    }

    @Test
    void findRelatedRespectsLimit() {
        postService.create(new PostRequest(
                "Related Limit Source", "related-limit-source", "excerpt", "content",
                "Limit", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, null
        , null, null), null);
        for (int i = 0; i < 3; i++) {
            postService.create(new PostRequest(
                    "Related Limit Candidate " + i, "related-limit-candidate-" + i, "excerpt", "content",
                    "Limit", List.of(),
                    PostStatus.PUBLISHED, PostVisibility.PUBLIC, null
            , null, null), null);
        }

        List<RelatedPostResponse> related = postService.findRelated("related-limit-source", 2);

        assertThat(related).hasSize(2);
    }
}
