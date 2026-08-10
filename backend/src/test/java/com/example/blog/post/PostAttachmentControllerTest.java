package com.example.blog.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.access.AccessGroup;
import com.example.blog.access.AccessGroupRepository;
import com.example.blog.access.PostAccessGroup;
import com.example.blog.access.PostAccessGroupRepository;
import com.example.blog.access.UserAccessGroup;
import com.example.blog.access.UserAccessGroupRepository;
import com.example.blog.auth.LoginRequest;
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
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;

/** Upload / view / delete for post attachments (PDF/DOC/DOCX/TXT), including the
 * private-post access gate that content_images/content_videos don't have. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostAttachmentControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired PostRepository postRepository;
    @Autowired AccessGroupRepository accessGroupRepository;
    @Autowired UserAccessGroupRepository userAccessGroupRepository;
    @Autowired PostAccessGroupRepository postAccessGroupRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void seedUsers() {
        ensureUser("pa_admin", UserRole.ADMIN, UserStatus.ACTIVE);
        ensureUser("pa_member_ingroup", UserRole.MEMBER, UserStatus.ACTIVE);
        ensureUser("pa_member_nogroup", UserRole.MEMBER, UserStatus.ACTIVE);
    }

    @Test
    void uploadValidPdfSucceedsAndAppearsOnPostDetail() throws Exception {
        String token = adminToken();
        long postId = createPost(token, "pa-pdf-post");

        MockMultipartFile pdf = new MockMultipartFile("file", "report.pdf", "application/pdf", minimalPdfBytes());

        MvcResult uploadResult = mockMvc.perform(multipart("/api/admin/posts/{id}/attachments", postId)
                        .file(pdf)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.originalFilename").value("report.pdf"))
                .andExpect(jsonPath("$.attachmentType").value("PDF"))
                .andExpect(jsonPath("$.url").exists())
                .andReturn();
        JsonNode uploaded = objectMapper.readTree(uploadResult.getResponse().getContentAsString());
        assertThat(uploaded.get("url").asText()).isEqualTo("/api/posts/" + postId + "/attachments/" + uploaded.get("id").asLong());

        mockMvc.perform(get("/api/posts/pa-pdf-post"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.attachments.length()").value(1))
                .andExpect(jsonPath("$.attachments[0].originalFilename").value("report.pdf"))
                .andExpect(jsonPath("$.attachments[0].attachmentType").value("PDF"));
    }

    @Test
    void uploadRejectsDisallowedContentType() throws Exception {
        String token = adminToken();
        long postId = createPost(token, "pa-badtype-post");

        MockMultipartFile png = new MockMultipartFile("file", "cover.png", "image/png", new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/api/admin/posts/{id}/attachments", postId)
                        .file(png)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRejectsFileOver20MB() throws Exception {
        String token = adminToken();
        long postId = createPost(token, "pa-toobig-post");

        byte[] big = new byte[21 * 1024 * 1024];
        MockMultipartFile pdf = new MockMultipartFile("file", "huge.pdf", "application/pdf", big);

        mockMvc.perform(multipart("/api/admin/posts/{id}/attachments", postId)
                        .file(pdf)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadWithoutAuthIsRejected() throws Exception {
        String token = adminToken();
        long postId = createPost(token, "pa-noauth-post");

        MockMultipartFile pdf = new MockMultipartFile("file", "report.pdf", "application/pdf", minimalPdfBytes());

        mockMvc.perform(multipart("/api/admin/posts/{id}/attachments", postId).file(pdf))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void getAttachmentReturnsBytesWithInlineDisposition() throws Exception {
        String token = adminToken();
        long postId = createPost(token, "pa-view-post");
        long attachmentId = uploadPdf(token, postId, "notes.pdf");

        mockMvc.perform(get("/api/posts/{id}/attachments/{attachmentId}", postId, attachmentId))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("inline")));
    }

    @Test
    void deleteAttachmentRemovesItAndSubsequentViewIs404() throws Exception {
        String token = adminToken();
        long postId = createPost(token, "pa-delete-post");
        long attachmentId = uploadPdf(token, postId, "temp.pdf");

        mockMvc.perform(delete("/api/admin/posts/{id}/attachments/{attachmentId}", postId, attachmentId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/posts/{id}/attachments/{attachmentId}", postId, attachmentId))
                .andExpect(status().isNotFound());
    }

    @Test
    void privatePostAttachmentIsHiddenFromMemberWithoutAccess() throws Exception {
        String token = adminToken();
        long postId = createPrivatePost(token, "pa-private-post", "pa-group");
        long attachmentId = uploadPdf(token, postId, "confidential.pdf");

        String outsiderToken = memberToken("pa_member_nogroup");

        mockMvc.perform(get("/api/posts/{id}/attachments/{attachmentId}", postId, attachmentId)
                        .header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isNotFound());
    }

    @Test
    void privatePostAttachmentIsVisibleToMemberWithGroupAccess() throws Exception {
        String token = adminToken();
        long postId = createPrivatePost(token, "pa-private-post-2", "pa-group-2");
        long attachmentId = uploadPdf(token, postId, "confidential-2.pdf");

        grantGroup("pa_member_ingroup", "pa-group-2");
        String memberToken = memberToken("pa_member_ingroup");

        mockMvc.perform(get("/api/posts/{id}/attachments/{attachmentId}", postId, attachmentId)
                        .header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"));
    }

    @Test
    void deletingPostWithAttachmentsSucceeds() throws Exception {
        // Regression test: post_attachments has a required post_id FK; deleting the
        // parent post must clean those rows up first or the delete 500s.
        String token = adminToken();
        long postId = createPost(token, "pa-cascade-delete-post");
        uploadPdf(token, postId, "will-be-orphaned.pdf");

        mockMvc.perform(delete("/api/posts/{id}", postId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/posts/pa-cascade-delete-post"))
                .andExpect(status().isNotFound());
    }

    // --- helpers ---

    private long uploadPdf(String token, long postId, String filename) throws Exception {
        MockMultipartFile pdf = new MockMultipartFile("file", filename, "application/pdf", minimalPdfBytes());
        MvcResult result = mockMvc.perform(multipart("/api/admin/posts/{id}/attachments", postId)
                        .file(pdf)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private long createPost(String token, String slug) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/posts")
                        .param("title", "Attachment Test " + slug)
                        .param("slug", slug)
                        .param("content", "Body content for " + slug)
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private long createPrivatePost(String token, String slug, String groupSlug) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/posts")
                        .param("title", "Private Attachment Test " + slug)
                        .param("slug", slug)
                        .param("content", "Secret body for " + slug)
                        .param("status", "PUBLISHED")
                        .param("visibility", "PRIVATE")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        long postId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();

        AccessGroup group = accessGroupRepository.findBySlug(groupSlug).orElseGet(() -> {
            AccessGroup g = new AccessGroup();
            g.setName(groupSlug);
            g.setSlug(groupSlug);
            g.setEnabled(true);
            return accessGroupRepository.save(g);
        });
        Post post = postRepository.findById(postId).orElseThrow();
        if (postAccessGroupRepository.findByPostId(postId).isEmpty()) {
            PostAccessGroup pag = new PostAccessGroup();
            pag.setPost(post);
            pag.setAccessGroup(group);
            postAccessGroupRepository.save(pag);
        }
        return postId;
    }

    private void grantGroup(String username, String groupSlug) {
        User user = userRepository.findByUsername(username).orElseThrow();
        AccessGroup group = accessGroupRepository.findBySlug(groupSlug).orElseThrow();
        if (userAccessGroupRepository.existsByUserIdAndAccessGroupId(user.getId(), group.getId())) {
            return;
        }
        UserAccessGroup uag = new UserAccessGroup();
        uag.setUser(user);
        uag.setAccessGroup(group);
        userAccessGroupRepository.save(uag);
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

    private String adminToken() throws Exception {
        return tokenFor("pa_admin", "Passw0rd!");
    }

    private String memberToken(String username) throws Exception {
        return tokenFor(username, "Passw0rd!");
    }

    private String tokenFor(String username, String password) throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest(username, password));
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(response);
        return node.get("token").asText();
    }

    /** Minimal valid PDF bytes (header + EOF marker) — enough for our controller, which never parses it. */
    private byte[] minimalPdfBytes() {
        return "%PDF-1.4\n%%EOF".getBytes();
    }
}
