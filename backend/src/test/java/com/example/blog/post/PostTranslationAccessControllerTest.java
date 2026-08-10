package com.example.blog.post;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.access.AccessGroup;
import com.example.blog.access.AccessGroupRepository;
import com.example.blog.access.AccessGroupService;
import com.example.blog.access.AccessRequestApproval;
import com.example.blog.access.AccessRequestRequest;
import com.example.blog.access.AccessRequestService;
import com.example.blog.auth.LoginRequest;
import com.example.blog.common.ContentLanguage;
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
 * The non-negotiable acceptance test for R2 in docs/10-multilingual-content.md
 * §8: PRIVATE + a group grant on the VI row must deny a non-granted MEMBER on
 * the EN slug too — access configuration is a property of the translation
 * group, not of one row. Also covers the AccessRequest group-wide-approval
 * consequence noted in §2.4.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostTranslationAccessControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired PostService postService;
    @Autowired PostRepository postRepository;
    @Autowired UserRepository userRepository;
    @Autowired AccessGroupRepository accessGroupRepository;
    @Autowired AccessGroupService accessGroupService;
    @Autowired AccessRequestService accessRequestService;
    @Autowired PasswordEncoder passwordEncoder;

    private Post viPost;
    private Post enPost;
    private AccessGroup group;

    @BeforeEach
    void setUp() {
        // Fetched via the repository (not the access-checked
        // PostService.findBySlug) — @BeforeEach runs anonymous, and a prior
        // test method in this class already leaves ml-r2-vi PRIVATE.
        viPost = postRepository.findBySlug("ml-r2-vi").orElse(null);
        // Idempotent one-time setup: run the whole PRIVATE + group-grant write
        // path exactly once (guarded on the row not existing yet), same
        // "if not already present" idiom PostVisibilityControllerTest uses —
        // AccessGroupService's delete-then-insert methods are not safe to call
        // repeatedly, unguarded, from independent transactions the way
        // @BeforeEach would otherwise do across this class's 4 test methods.
        if (viPost == null) {
            Long viId = postService.create(new PostRequest(
                    "R2 VI", "ml-r2-vi", "excerpt", "SECRET-VI", "Test", List.of(),
                    PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                    ContentLanguage.VI, null
            ), null).id();
            postService.create(new PostRequest(
                    "R2 EN", "ml-r2-en", "excerpt", "SECRET-EN", "Test", List.of(),
                    PostStatus.PUBLISHED, PostVisibility.PUBLIC, PostMetadataVisibility.PUBLIC_METADATA,
                    ContentLanguage.EN, viId
            ), null);

            group = accessGroupRepository.findBySlug("ml-r2-group").orElseGet(() -> {
                AccessGroup g = new AccessGroup();
                g.setName("ML R2 Group");
                g.setSlug("ml-r2-group");
                g.setEnabled(true);
                return accessGroupRepository.save(g);
            });

            ensureUser("ml_r2_granted", UserRole.MEMBER, UserStatus.ACTIVE);
            ensureUser("ml_r2_ungranted", UserRole.MEMBER, UserStatus.ACTIVE);
            ensureUser("ml_r2_requester", UserRole.MEMBER, UserStatus.ACTIVE);

            // Setting visibility=PRIVATE + a group grant on the VI row must
            // propagate to the EN sibling automatically (docs/10 §2.3/§2.4) —
            // this is the write path under test, not a manual fixture on both rows.
            postService.update(viId, new PostRequest(
                    "R2 VI", "ml-r2-vi", "excerpt", "SECRET-VI", "Test", List.of(),
                    PostStatus.PUBLISHED, PostVisibility.PRIVATE, PostMetadataVisibility.PUBLIC_METADATA,
                    null, null
            ), null, false);
            accessGroupService.setPostAccessGroups(viId, List.of(group.getId()));

            User granted = userRepository.findByUsername("ml_r2_granted").orElseThrow();
            accessGroupService.addUserToGroup(group.getId(), granted.getId(), null);

            viPost = postRepository.findBySlug("ml-r2-vi").orElseThrow();
        } else {
            group = accessGroupRepository.findBySlug("ml-r2-group").orElseThrow();
        }
        enPost = postRepository.findBySlug("ml-r2-en").orElseThrow();
    }

    private void ensureUser(String username, UserRole role, UserStatus status) {
        userRepository.findByUsername(username).orElseGet(() -> {
            User u = new User();
            u.setUsername(username);
            u.setEmail(username + "@test.local");
            u.setPassword(passwordEncoder.encode("Passw0rd!"));
            u.setRole(role);
            u.setStatus(status);
            return userRepository.save(u);
        });
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
    void groupVisibilityChangeOnViRowPropagatesToEnSibling() {
        Post enEntity = postRepository.findBySlug("ml-r2-en").orElseThrow();
        org.assertj.core.api.Assertions.assertThat(enEntity.getVisibility()).isEqualTo(PostVisibility.PRIVATE);
    }

    @Test
    void nonGrantedMemberIsDeniedOnBothTheViAndEnSlug() throws Exception {
        String token = tokenFor("ml_r2_ungranted");
        mockMvc.perform(get("/api/posts/ml-r2-vi").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NO_ACCESS"));
        mockMvc.perform(get("/api/posts/ml-r2-en").header("Authorization", "Bearer " + token))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NO_ACCESS"));
    }

    @Test
    void groupGrantOnViRowAllowsReadingBothTheViAndEnSlug() throws Exception {
        String token = tokenFor("ml_r2_granted");
        mockMvc.perform(get("/api/posts/ml-r2-vi").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("SECRET-VI"));
        mockMvc.perform(get("/api/posts/ml-r2-en").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("SECRET-EN"));
    }

    @Test
    void approvingAnAccessRequestAgainstTheEnRowGrantsTheViRowToo() throws Exception {
        User requester = userRepository.findByUsername("ml_r2_requester").orElseThrow();
        accessRequestService.create(requester.getId(), new AccessRequestRequest("ml-r2-en", "please"));
        var pending = accessRequestService.listByStatus(
                com.example.blog.access.AccessRequestStatus.PENDING).stream()
                .filter(r -> r.userId().equals(requester.getId()))
                .findFirst().orElseThrow();
        accessRequestService.approve(pending.id(), new AccessRequestApproval(AccessRequestApproval.GrantVia.DIRECT,
                null), null);

        String token = tokenFor("ml_r2_requester");
        mockMvc.perform(get("/api/posts/ml-r2-vi").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.content").value("SECRET-VI"));
    }
}
