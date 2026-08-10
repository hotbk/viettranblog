package com.example.blog.post;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.access.AccessGroup;
import com.example.blog.access.AccessGroupRepository;
import com.example.blog.access.PostAccessGroup;
import com.example.blog.access.PostAccessGroupRepository;
import com.example.blog.access.PostUserPermission;
import com.example.blog.access.PostUserPermissionRepository;
import com.example.blog.access.UserAccessGroup;
import com.example.blog.access.UserAccessGroupRepository;
import com.example.blog.auth.LoginRequest;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import com.example.blog.user.UserStatus;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
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
 * End-to-end authorization matrix for private posts (see plan §D) — every
 * case goes through real HTTP + a real login, no mocking, matching this
 * project's existing test convention (AuthControllerTest).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostVisibilityControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired PostRepository postRepository;
    @Autowired AccessGroupRepository accessGroupRepository;
    @Autowired UserAccessGroupRepository userAccessGroupRepository;
    @Autowired PostAccessGroupRepository postAccessGroupRepository;
    @Autowired PostUserPermissionRepository postUserPermissionRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private Post publicPost;
    private Post privatePost;
    private AccessGroup groupA;
    private AccessGroup groupB;

    @BeforeEach
    void setUp() {
        publicPost = postRepository.findBySlug("pv-public-post").orElseGet(() -> {
            Post p = newPost("pv-public-post", PostVisibility.PUBLIC);
            return postRepository.save(p);
        });
        privatePost = postRepository.findBySlug("pv-private-post").orElseGet(() -> {
            Post p = newPost("pv-private-post", PostVisibility.PRIVATE);
            return postRepository.save(p);
        });

        groupA = accessGroupRepository.findBySlug("pv-group-a").orElseGet(() -> {
            AccessGroup g = new AccessGroup();
            g.setName("Group A");
            g.setSlug("pv-group-a");
            g.setEnabled(true);
            return accessGroupRepository.save(g);
        });
        groupB = accessGroupRepository.findBySlug("pv-group-b").orElseGet(() -> {
            AccessGroup g = new AccessGroup();
            g.setName("Group B");
            g.setSlug("pv-group-b");
            g.setEnabled(true);
            return accessGroupRepository.save(g);
        });

        if (postAccessGroupRepository.findByPostId(privatePost.getId()).isEmpty()) {
            PostAccessGroup pag = new PostAccessGroup();
            pag.setPost(privatePost);
            pag.setAccessGroup(groupA);
            postAccessGroupRepository.save(pag);
        }

        ensureUser("pv_active_nomembership", UserRole.MEMBER, UserStatus.ACTIVE);
        ensureUser("pv_active_groupa", UserRole.MEMBER, UserStatus.ACTIVE);
        ensureUser("pv_active_groupb_only", UserRole.MEMBER, UserStatus.ACTIVE);
        ensureUser("pv_active_direct", UserRole.MEMBER, UserStatus.ACTIVE);
        ensureUser("pv_pending", UserRole.MEMBER, UserStatus.PENDING);
        ensureUser("pv_rejected", UserRole.MEMBER, UserStatus.REJECTED);
        ensureUser("pv_suspended_ingroup", UserRole.MEMBER, UserStatus.SUSPENDED);
        ensureUser("pv_admin", UserRole.ADMIN, UserStatus.ACTIVE);

        grantGroup("pv_active_groupa", groupA);
        grantGroup("pv_active_groupb_only", groupB);
        grantGroup("pv_suspended_ingroup", groupA); // membership present, but account suspended
        grantDirect("pv_active_direct", privatePost);
    }

    private Post newPost(String slug, PostVisibility visibility) {
        Post p = new Post();
        p.setTitle("PV Test " + slug);
        p.setSlug(slug);
        p.setExcerpt("excerpt");
        p.setContent("SECRET-CONTENT-" + slug);
        p.setCategory("Test");
        p.setTags("");
        p.setStatus(PostStatus.PUBLISHED);
        p.setVisibility(visibility);
        p.setPrivateMetadataVisibility(PostMetadataVisibility.PUBLIC_METADATA);
        p.setCoverImageData(new byte[]{1, 2, 3});
        p.setCoverImageContentType("image/png");
        return p;
    }

    private User ensureUser(String username, UserRole role, UserStatus status) {
        return userRepository.findByUsername(username).orElseGet(() -> {
            User u = new User();
            u.setUsername(username);
            u.setEmail(username + "@test.local");
            u.setPassword(passwordEncoder.encode("Passw0rd!"));
            u.setRole(role);
            u.setStatus(status);
            return userRepository.save(u);
        });
    }

    private void grantGroup(String username, AccessGroup group) {
        User user = userRepository.findByUsername(username).orElseThrow();
        if (userAccessGroupRepository.existsByUserIdAndAccessGroupId(user.getId(), group.getId())) {
            return;
        }
        UserAccessGroup uag = new UserAccessGroup();
        uag.setUser(user);
        uag.setAccessGroup(group);
        userAccessGroupRepository.save(uag);
    }

    private void grantDirect(String username, Post post) {
        User user = userRepository.findByUsername(username).orElseThrow();
        if (postUserPermissionRepository.existsByPostIdAndUserId(post.getId(), user.getId())) {
            return;
        }
        PostUserPermission perm = new PostUserPermission();
        perm.setUser(user);
        perm.setPost(post);
        postUserPermissionRepository.save(perm);
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
    void anonymousCanReadPublicPost() throws Exception {
        mockMvc.perform(get("/api/posts/" + publicPost.getSlug()))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").exists());
    }

    @Test
    void anonymousIsDeniedPrivatePostWith401AndNoContent() throws Exception {
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.code").value("NOT_AUTHENTICATED"))
                .andExpect(jsonPath("$.content").doesNotExist());
    }

    @Test
    void pendingUserIsDenied() throws Exception {
        String token = tokenFor("pv_pending");
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_PENDING"));
    }

    @Test
    void rejectedUserIsDenied() throws Exception {
        String token = tokenFor("pv_rejected");
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_REJECTED"));
    }

    @Test
    void suspendedUserIsDeniedEvenWithStaleGroupMembership() throws Exception {
        String token = tokenFor("pv_suspended_ingroup");
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("ACCOUNT_SUSPENDED"));
    }

    @Test
    void activeUserWithoutPermissionIsDenied() throws Exception {
        String token = tokenFor("pv_active_nomembership");
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NO_ACCESS"));
    }

    @Test
    void activeUserInWrongGroupIsDenied() throws Exception {
        String token = tokenFor("pv_active_groupb_only");
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NO_ACCESS"));
    }

    @Test
    void activeUserInCorrectGroupIsAllowed() throws Exception {
        String token = tokenFor("pv_active_groupa");
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("SECRET-CONTENT-pv-private-post"));
    }

    @Test
    void activeUserWithDirectGrantIsAllowed() throws Exception {
        String token = tokenFor("pv_active_direct");
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("SECRET-CONTENT-pv-private-post"));
    }

    @Test
    void adminIsAlwaysAllowed() throws Exception {
        String token = tokenFor("pv_admin");
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void publicListingOmitsFullContentOfPrivatePostForUnauthorizedViewer() throws Exception {
        mockMvc.perform(get("/api/posts"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='" + privatePost.getSlug() + "')].content")
                        .value(org.hamcrest.Matchers.everyItem(org.hamcrest.Matchers.nullValue())));
    }

    @Test
    void coverImageEndpointIs404ForUnauthorizedViewer() throws Exception {
        mockMvc.perform(get("/api/posts/" + privatePost.getId() + "/cover-image"))
                .andExpect(status().isNotFound());
    }

    @Test
    void commentsEndpointIs404ForUnauthorizedViewerOnPrivatePost() throws Exception {
        mockMvc.perform(get("/api/posts/" + privatePost.getSlug() + "/comments"))
                .andExpect(status().isNotFound());
    }
}
