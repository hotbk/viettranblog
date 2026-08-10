package com.example.blog.seo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.common.ContentLanguage;
import com.example.blog.post.Post;
import com.example.blog.post.PostMetadataVisibility;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostRequest;
import com.example.blog.post.PostResponse;
import com.example.blog.post.PostService;
import com.example.blog.post.PostStatus;
import com.example.blog.post.PostVisibility;
import java.util.List;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SitemapControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired PostRepository postRepository;
    @Autowired PostService postService;

    @BeforeEach
    void seedPosts() {
        save("sm-public-published", PostStatus.PUBLISHED, PostVisibility.PUBLIC);
        save("sm-private-published", PostStatus.PUBLISHED, PostVisibility.PRIVATE);
        save("sm-public-draft", PostStatus.DRAFT, PostVisibility.PUBLIC);
    }

    // TC-1: public+published post appears; private and draft posts never do (anonymous, no auth needed)
    @Test
    void sitemapListsOnlyPublicPublishedPosts() throws Exception {
        MvcResult result = mockMvc.perform(get("/api/sitemap.xml"))
                .andExpect(status().isOk())
                .andExpect(content().contentTypeCompatibleWith("application/xml"))
                .andReturn();

        String xml = result.getResponse().getContentAsString();
        assertThat(xml).contains("<loc>http://localhost:5173/</loc>");
        assertThat(xml).contains("/posts/sm-public-published</loc>");
        assertThat(xml).doesNotContain("/posts/sm-private-published");
        assertThat(xml).doesNotContain("/posts/sm-public-draft");
    }

    // TC-2: a real VI/EN translation pair emits reciprocal, self-inclusive
    // hreflang alternates + x-default (docs/10-multilingual-content.md §5.1).
    @Test
    void sitemapEmitsReciprocalSelfInclusiveHreflangAlternatesForATranslationPair() throws Exception {
        PostResponse vi = postService.create(new PostRequest(
                "Sitemap ML VI", "sm-ml-vi", "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.VI, null
        ), null);
        postService.create(new PostRequest(
                "Sitemap ML EN", "sm-ml-en", "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, vi.id()
        ), null);

        String xml = mockMvc.perform(get("/api/sitemap.xml"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(xml).contains("xmlns:xhtml=\"http://www.w3.org/1999/xhtml\"");
        assertThat(xml).contains(
                "<xhtml:link rel=\"alternate\" hreflang=\"vi\" href=\"http://localhost:5173/posts/sm-ml-vi\"/>");
        assertThat(xml).contains(
                "<xhtml:link rel=\"alternate\" hreflang=\"en\" href=\"http://localhost:5173/posts/sm-ml-en\"/>");
        assertThat(xml).contains(
                "<xhtml:link rel=\"alternate\" hreflang=\"x-default\" href=\"http://localhost:5173/posts/sm-ml-vi\"/>");
    }

    // TC-3: a group of one (every pre-existing/singleton post) emits no alternates at all (R8/§5.1).
    @Test
    void sitemapEmitsNoAlternatesForASingletonPost() throws Exception {
        String xml = mockMvc.perform(get("/api/sitemap.xml"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        // sm-public-published (seeded in @BeforeEach) has no sibling.
        int locIdx = xml.indexOf("/posts/sm-public-published</loc>");
        assertThat(locIdx).isPositive();
        String urlBlock = xml.substring(xml.lastIndexOf("<url>", locIdx), xml.indexOf("</url>", locIdx));
        assertThat(urlBlock).doesNotContain("xhtml:link");
    }

    // TC-4: a DRAFT/PRIVATE sibling is never advertised as an alternate — the
    // hreflang map is built strictly from the already PUBLISHED+PUBLIC filtered
    // list, not the raw translation group (docs/10 §5.1, a leak this feature
    // must not introduce).
    @Test
    void sitemapNeverListsADraftOrPrivateSiblingAsAnAlternate() throws Exception {
        PostResponse vi = postService.create(new PostRequest(
                "Sitemap ML Gated VI", "sm-ml-gated-vi", "excerpt", "content", "Test", List.of(),
                PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.VI, null
        ), null);
        postService.create(new PostRequest(
                "Sitemap ML Gated EN Draft", "sm-ml-gated-en-draft", "excerpt", "content", "Test", List.of(),
                PostStatus.DRAFT, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                ContentLanguage.EN, vi.id()
        ), null);

        String xml = mockMvc.perform(get("/api/sitemap.xml"))
                .andExpect(status().isOk())
                .andReturn().getResponse().getContentAsString();

        assertThat(xml).doesNotContain("sm-ml-gated-en-draft");
        int locIdx = xml.indexOf("/posts/sm-ml-gated-vi</loc>");
        String urlBlock = xml.substring(xml.lastIndexOf("<url>", locIdx), xml.indexOf("</url>", locIdx));
        assertThat(urlBlock).doesNotContain("xhtml:link"); // the DRAFT sibling leaves this a group of one, publicly
    }

    private void save(String slug, PostStatus status, PostVisibility visibility) {
        if (postRepository.findBySlug(slug).isPresent()) return;
        Post p = new Post();
        p.setTitle("Sitemap test " + slug);
        p.setSlug(slug);
        p.setExcerpt("excerpt");
        p.setContent("content");
        p.setCategory("Test");
        p.setTags("");
        p.setStatus(status);
        p.setVisibility(visibility);
        p.setPrivateMetadataVisibility(PostMetadataVisibility.PUBLIC_METADATA);
        postRepository.save(p);
    }
}
