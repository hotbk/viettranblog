package com.example.blog.comment;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.post.Post;
import com.example.blog.post.PostMetadataVisibility;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostStatus;
import com.example.blog.post.PostVisibility;
import com.example.blog.series.Series;
import com.example.blog.series.SeriesPost;
import com.example.blog.series.SeriesPostRepository;
import com.example.blog.series.SeriesRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Regression coverage for the two leak vectors found while designing the
 * private-post feature (plan §A): comments resolving a post by slug with no
 * visibility check, and series detail exposing every linked post regardless
 * of visibility.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class CommentSeriesLeakTest {

    @Autowired MockMvc mockMvc;
    @Autowired PostRepository postRepository;
    @Autowired SeriesRepository seriesRepository;
    @Autowired SeriesPostRepository seriesPostRepository;

    private Post privatePost;
    private Post publicPost;

    @BeforeEach
    void setUp() {
        privatePost = postRepository.findBySlug("leak-private-post").orElseGet(() -> {
            Post p = new Post();
            p.setTitle("Leak Test Private");
            p.setSlug("leak-private-post");
            p.setExcerpt("excerpt");
            p.setContent("SECRET");
            p.setCategory("Test");
            p.setTags("");
            p.setStatus(PostStatus.PUBLISHED);
            p.setVisibility(PostVisibility.PRIVATE);
            p.setPrivateMetadataVisibility(PostMetadataVisibility.PUBLIC_METADATA);
            return postRepository.save(p);
        });

        publicPost = postRepository.findBySlug("leak-public-post").orElseGet(() -> {
            Post p = new Post();
            p.setTitle("Leak Test Public");
            p.setSlug("leak-public-post");
            p.setExcerpt("excerpt");
            p.setContent("PUBLIC-CONTENT");
            p.setCategory("Test");
            p.setTags("");
            p.setStatus(PostStatus.PUBLISHED);
            p.setVisibility(PostVisibility.PUBLIC);
            p.setPrivateMetadataVisibility(PostMetadataVisibility.PUBLIC_METADATA);
            return postRepository.save(p);
        });

        if (seriesRepository.findBySlug("leak-test-series").isEmpty()) {
            Series series = new Series();
            series.setTitle("Leak Test Series");
            series.setSlug("leak-test-series");
            series.setDescription("desc");
            series.setStatus(PostStatus.PUBLISHED);
            series = seriesRepository.save(series);

            SeriesPost sp1 = new SeriesPost();
            sp1.setSeries(series);
            sp1.setPost(publicPost);
            sp1.setPosition(1);
            seriesPostRepository.save(sp1);

            SeriesPost sp2 = new SeriesPost();
            sp2.setSeries(series);
            sp2.setPost(privatePost);
            sp2.setPosition(2);
            seriesPostRepository.save(sp2);
        }
    }

    @Test
    void commentsGetIs404NotAnEmptyListForPrivatePostSlug() throws Exception {
        // Before this feature, this would have returned 200 [] — confirming
        // the slug exists and is a valid post, just with no comments. Now it
        // must be indistinguishable from a slug that doesn't exist at all.
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug() + "/comments"))
                .andExpect(status().isNotFound());
    }

    @Test
    void commentsPostIs404ForPrivatePostSlug() throws Exception {
        mockMvc.perform(post("/api/posts/" + privatePost.getSlug() + "/comments")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"authorName\":\"x\",\"content\":\"y\"}"))
                .andExpect(status().isNotFound());
    }

    /**
     * Updated 2026-08-08: a PUBLIC_METADATA private post now shows as a
     * locked teaser (accessible=false) in series detail instead of vanishing
     * entirely — brought in line with how PostService.search already treats
     * PUBLIC_METADATA private posts on the home listing (see SeriesAccessTest
     * for the full accessible/teaser/omit matrix, including the
     * AUTHORIZED_ONLY case, which IS still fully omitted). Before this
     * change, a series linking only inaccessible private posts read as
     * completely empty/broken to an anonymous viewer, which is the bug this
     * test now guards against instead of asserting.
     */
    @Test
    void seriesDetailShowsPrivatePostAsLockedTeaserForAnonymousViewer() throws Exception {
        mockMvc.perform(get("/api/series/leak-test-series"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[?(@.slug=='" + privatePost.getSlug() + "')].accessible").value(false))
                .andExpect(jsonPath("$.posts[?(@.slug=='" + privatePost.getSlug() + "')].title").exists())
                .andExpect(jsonPath("$.posts[?(@.slug=='" + publicPost.getSlug() + "')].accessible").value(true))
                .andExpect(jsonPath("$.postCount").value(2));
    }
}
