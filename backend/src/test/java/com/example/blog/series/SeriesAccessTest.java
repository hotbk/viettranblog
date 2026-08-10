package com.example.blog.series;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.access.AccessGroup;
import com.example.blog.access.AccessGroupRepository;
import com.example.blog.access.PostAccessGroup;
import com.example.blog.access.PostAccessGroupRepository;
import com.example.blog.access.UserAccessGroup;
import com.example.blog.access.UserAccessGroupRepository;
import com.example.blog.auth.LoginRequest;
import com.example.blog.post.Post;
import com.example.blog.post.PostMetadataVisibility;
import com.example.blog.post.PostRepository;
import com.example.blog.post.PostStatus;
import com.example.blog.post.PostVisibility;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import com.example.blog.user.UserStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

/**
 * Regression coverage for the bug reported live: a series linking a PRIVATE
 * post the viewer can't read used to just vanish from GET /api/series/{slug}
 * (posts:[] even though the series has linked posts), reading as "series is
 * broken/empty". Now it shows as a locked teaser (PUBLIC_METADATA) or is
 * cleanly omitted (AUTHORIZED_ONLY) — mirrors PostVisibilityControllerTest's
 * approach for the equivalent post-listing behavior.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class SeriesAccessTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired PostRepository postRepository;
    @Autowired SeriesRepository seriesRepository;
    @Autowired SeriesPostRepository seriesPostRepository;
    @Autowired AccessGroupRepository accessGroupRepository;
    @Autowired UserAccessGroupRepository userAccessGroupRepository;
    @Autowired PostAccessGroupRepository postAccessGroupRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private Series series;

    @BeforeEach
    void setUp() {
        Post publicPost = ensurePost("sa-public-post", PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA);
        Post teaserPost = ensurePost("sa-teaser-post", PostVisibility.PRIVATE, PostMetadataVisibility.PUBLIC_METADATA);
        Post hiddenPost = ensurePost("sa-hidden-post", PostVisibility.PRIVATE, PostMetadataVisibility.AUTHORIZED_ONLY);

        AccessGroup group = accessGroupRepository.findBySlug("sa-group").orElseGet(() -> {
            AccessGroup g = new AccessGroup();
            g.setName("SA Group");
            g.setSlug("sa-group");
            g.setEnabled(true);
            return accessGroupRepository.save(g);
        });
        grantGroup(teaserPost, group);
        grantGroup(hiddenPost, group);

        ensureUser("sa_member_in", UserStatus.ACTIVE);
        addUserToGroup("sa_member_in", group);

        series = seriesRepository.findBySlug("sa-series").orElseGet(() -> {
            Series s = new Series();
            s.setTitle("SA Series");
            s.setSlug("sa-series");
            s.setDescription("desc");
            s.setStatus(PostStatus.PUBLISHED);
            return seriesRepository.save(s);
        });
        linkIfAbsent(series, publicPost, 1);
        linkIfAbsent(series, teaserPost, 2);
        linkIfAbsent(series, hiddenPost, 3);
    }

    private Post ensurePost(String slug, PostVisibility visibility, PostMetadataVisibility metaVisibility) {
        return postRepository.findBySlug(slug).orElseGet(() -> {
            Post p = new Post();
            p.setTitle("SA " + slug);
            p.setSlug(slug);
            p.setExcerpt("excerpt-" + slug);
            p.setContent("content-" + slug);
            p.setCategory("Test");
            p.setTags("");
            p.setStatus(PostStatus.PUBLISHED);
            p.setVisibility(visibility);
            p.setPrivateMetadataVisibility(metaVisibility);
            return postRepository.save(p);
        });
    }

    private void grantGroup(Post post, AccessGroup group) {
        if (postAccessGroupRepository.findByPostId(post.getId()).stream()
                .anyMatch(pag -> pag.getAccessGroup().getId().equals(group.getId()))) {
            return;
        }
        PostAccessGroup pag = new PostAccessGroup();
        pag.setPost(post);
        pag.setAccessGroup(group);
        postAccessGroupRepository.save(pag);
    }

    private User ensureUser(String username, UserStatus status) {
        return userRepository.findByUsername(username).orElseGet(() -> {
            User u = new User();
            u.setUsername(username);
            u.setEmail(username + "@test.local");
            u.setPassword(passwordEncoder.encode("Passw0rd!"));
            u.setRole(UserRole.MEMBER);
            u.setStatus(status);
            return userRepository.save(u);
        });
    }

    private void addUserToGroup(String username, AccessGroup group) {
        User user = userRepository.findByUsername(username).orElseThrow();
        if (userAccessGroupRepository.existsByUserIdAndAccessGroupId(user.getId(), group.getId())) {
            return;
        }
        UserAccessGroup uag = new UserAccessGroup();
        uag.setUser(user);
        uag.setAccessGroup(group);
        userAccessGroupRepository.save(uag);
    }

    private void linkIfAbsent(Series series, Post post, int position) {
        boolean exists = seriesPostRepository.findBySeriesIdOrderByPositionAsc(series.getId()).stream()
                .anyMatch(sp -> sp.getPost().getId().equals(post.getId()));
        if (exists) return;
        SeriesPost sp = new SeriesPost();
        sp.setSeries(series);
        sp.setPost(post);
        sp.setPosition(position);
        seriesPostRepository.save(sp);
    }

    private String tokenFor(String username) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest(username, "Passw0rd!"));
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(response);
        return node.get("token").asText();
    }

    @Test
    void anonymousSeesPublicPostAndLockedTeaserButNotAuthorizedOnlyPost() throws Exception {
        mockMvc.perform(get("/api/series/sa-series"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[?(@.slug=='sa-public-post')].accessible").value(true))
                .andExpect(jsonPath("$.posts[?(@.slug=='sa-teaser-post')].accessible").value(false))
                .andExpect(jsonPath("$.posts[?(@.slug=='sa-teaser-post')].title").exists())
                .andExpect(jsonPath("$.posts[?(@.slug=='sa-hidden-post')]").isEmpty())
                // postCount reflects what's actually returned (2: public + teaser), not the raw link count (3)
                .andExpect(jsonPath("$.postCount").value(2));
    }

    @Test
    void memberInGroupSeesAllThreeAsFullyAccessible() throws Exception {
        String token = tokenFor("sa_member_in");
        mockMvc.perform(get("/api/series/sa-series").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.posts[?(@.slug=='sa-public-post')].accessible").value(true))
                .andExpect(jsonPath("$.posts[?(@.slug=='sa-teaser-post')].accessible").value(true))
                .andExpect(jsonPath("$.posts[?(@.slug=='sa-hidden-post')].accessible").value(true))
                .andExpect(jsonPath("$.postCount").value(3));
    }
}
