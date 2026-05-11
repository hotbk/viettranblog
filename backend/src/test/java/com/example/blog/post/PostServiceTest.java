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
                PostStatus.PUBLISHED
        ), null);

        postService.create(new PostRequest(
                "Draft Test",
                "draft-test",
                "Draft excerpt",
                "Draft content",
                "Test",
                List.of("draft"),
                PostStatus.DRAFT
        ), null);

        List<PostResponse> result = postService.search("Test", null, false);

        assertThat(result).extracting(PostResponse::slug).contains("published-test");
        assertThat(result).extracting(PostResponse::slug).doesNotContain("draft-test");
    }
}
