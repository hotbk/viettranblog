package com.example.blog.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.example.blog.common.ContentLanguage;
import com.example.blog.common.TranslationLanguageTakenException;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

/**
 * Service-level coverage for the dual-language content feature
 * (docs/10-multilingual-content.md, TASK-BE-016 / BE-L7). The access-control
 * acceptance test (R2) lives separately in
 * {@link PostTranslationAccessControllerTest} since it needs real HTTP + JWT.
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
class PostServiceMultilingualTest {

    @Autowired private PostService postService;
    @Autowired private PostRepository postRepository;

    private PostResponse createVi(String slug) {
        return postService.create(new PostRequest(
                "VI " + slug, slug, "excerpt", "content", "Test", List.of("tag"),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.VI, null
        ), null);
    }

    @Test
    void newStandalonePostBecomesAGroupOfOneEqualToItsOwnId() {
        PostResponse created = createVi("ml-standalone");
        Post entity = postRepository.findById(created.id()).orElseThrow();
        assertThat(entity.getTranslationGroupId()).isEqualTo(entity.getId());
    }

    @Test
    void creatingALinkedTranslationSharesTheSourcesTranslationGroupId() {
        PostResponse source = createVi("ml-source-1");
        PostResponse en = postService.create(new PostRequest(
                "EN ml-source-1", "ml-source-1-en", "excerpt", "content", "Test", List.of("tag"),
                PostStatus.DRAFT, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, source.id()
        ), null);

        Post sourceEntity = postRepository.findById(source.id()).orElseThrow();
        Post enEntity = postRepository.findById(en.id()).orElseThrow();
        assertThat(enEntity.getTranslationGroupId()).isEqualTo(sourceEntity.getTranslationGroupId());
        assertThat(enEntity.getTranslatedFromId()).isEqualTo(source.id());
    }

    @Test
    void creatingASecondPostOfTheSameLanguageInOneGroupIsRejected() {
        PostResponse source = createVi("ml-source-2");
        // A second VI post linked into the same group as another VI post -> 409.
        assertThatThrownBy(() -> postService.create(new PostRequest(
                "VI duplicate", "ml-source-2-dup", "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.VI, source.id()
        ), null)).isInstanceOf(TranslationLanguageTakenException.class);
    }

    @Test
    void languageQueryParamFiltersListing() {
        createVi("ml-lang-vi");
        postService.create(new PostRequest(
                "EN lang post", "ml-lang-en", "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, null
        ), null);

        List<PostResponse> enOnly = postService.search(null, null, false, ContentLanguage.EN);
        assertThat(enOnly).extracting(PostResponse::slug).contains("ml-lang-en");
        assertThat(enOnly).extracting(PostResponse::slug).doesNotContain("ml-lang-vi");
    }

    @Test
    void publicDetailOmitsDraftSiblingButAdminListingIncludesIt() {
        PostResponse source = createVi("ml-detail-src");
        postService.create(new PostRequest(
                "EN detail draft", "ml-detail-src-en", "excerpt", "content", "Test", List.of(),
                PostStatus.DRAFT, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, source.id()
        ), null);

        PostResponse publicDetail = postService.findBySlug("ml-detail-src");
        assertThat(publicDetail.translations()).isEmpty();

        List<PostResponse> adminListing = postService.search(null, null, true, null);
        PostResponse adminSourceRow = adminListing.stream()
                .filter(p -> p.slug().equals("ml-detail-src")).findFirst().orElseThrow();
        assertThat(adminSourceRow.translations()).extracting(PostResponse.TranslationRef::slug)
                .contains("ml-detail-src-en");
    }

    @Test
    void teaserRowHasEmptyTranslations() {
        PostResponse source = createVi("ml-teaser-src");
        postService.create(new PostRequest(
                "EN teaser sibling", "ml-teaser-src-en", "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, source.id()
        ), null);
        // Flip the group PRIVATE with no grants -> anonymous viewer sees a teaser.
        Post entity = postRepository.findById(source.id()).orElseThrow();
        entity.setVisibility(PostVisibility.PRIVATE);
        entity.setPrivateMetadataVisibility(PostMetadataVisibility.PUBLIC_METADATA);
        postRepository.save(entity);

        List<PostResponse> listing = postService.search(null, null, false, null);
        PostResponse teaser = listing.stream().filter(p -> p.slug().equals("ml-teaser-src")).findFirst()
                .orElseThrow();
        assertThat(teaser.accessible()).isFalse();
        assertThat(teaser.translations()).isEmpty();
    }

    @Test
    void deletingTheSourceLeavesTheSiblingIntactWithNoForeignKeyErrorAndDanglingReferenceTreatedAsNull() {
        PostResponse source = createVi("ml-delete-src");
        PostResponse en = postService.create(new PostRequest(
                "EN delete sibling", "ml-delete-src-en", "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, source.id()
        ), null);

        postService.delete(source.id());

        assertThat(postRepository.findById(source.id())).isEmpty();
        Post enEntity = postRepository.findById(en.id()).orElseThrow();
        assertThat(enEntity.getTranslatedFromId()).isEqualTo(source.id()); // still dangling, not cleaned up

        // The dangling reference must not blow up admin listing/staleness computation.
        List<PostResponse> adminListing = postService.search(null, null, true, null);
        PostResponse enRow = adminListing.stream().filter(p -> p.slug().equals("ml-delete-src-en")).findFirst()
                .orElseThrow();
        assertThat(enRow.translationStale()).isFalse();
    }

    @Test
    void unlinkingPutsThePostInAFreshGroupOfOneAndBothRemainReadable() {
        PostResponse source = createVi("ml-unlink-src");
        PostResponse en = postService.create(new PostRequest(
                "EN unlink sibling", "ml-unlink-src-en", "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, source.id()
        ), null);

        postService.linkTranslation(en.id(), null);

        Post enEntity = postRepository.findById(en.id()).orElseThrow();
        assertThat(enEntity.getTranslationGroupId()).isEqualTo(en.id());
        assertThat(enEntity.getTranslatedFromId()).isNull();

        // Both rows remain independently readable.
        assertThat(postService.findBySlug("ml-unlink-src").accessible()).isTrue();
        assertThat(postService.findBySlug("ml-unlink-src-en").accessible()).isTrue();
    }

    @Test
    void relatedPostsAreLanguageScopedAndExcludeTranslationGroupSiblings() {
        PostResponse source = postService.create(new PostRequest(
                "Related ML Source", "ml-related-source", "excerpt", "content",
                "SharedCat", List.of("shared-tag"),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.VI, null
        ), null);
        // Its own EN sibling: same category/tag, would otherwise score highly -> must be excluded.
        postService.create(new PostRequest(
                "Related ML Source EN", "ml-related-source-en", "excerpt", "content",
                "SharedCat", List.of("shared-tag"),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, source.id()
        ), null);
        // A genuine VI candidate, unrelated group, same category -> should appear.
        postService.create(new PostRequest(
                "Related ML Candidate", "ml-related-candidate", "excerpt", "content",
                "SharedCat", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.VI, null
        ), null);
        // An EN-only candidate that would match on category, but wrong language -> must be excluded.
        postService.create(new PostRequest(
                "Related ML EN Candidate", "ml-related-en-candidate", "excerpt", "content",
                "SharedCat", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, null
        ), null);

        List<RelatedPostResponse> related = postService.findRelated("ml-related-source", null);

        assertThat(related).extracting(RelatedPostResponse::slug)
                .contains("ml-related-candidate")
                .doesNotContain("ml-related-source-en", "ml-related-en-candidate");
    }
}
