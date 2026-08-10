package com.example.blog.seo;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.post.Post;
import com.example.blog.post.PostMetadataVisibility;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostStatus;
import com.example.blog.post.PostVisibility;
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
