package com.example.blog.tool;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

/** Admin CRUD + the public listing/raw-HTML surface for the Tools module
 * (docs/04-api-contract.md §11). The load-bearing behavior is `/raw`: it must
 * serve text/html byte-for-byte for a published+public tool, and 404 (not
 * leak existence) for anything else. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ToolControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private static final String SAMPLE_HTML =
            "<!doctype html><html><head><title>t</title></head><body><script>console.log(1)</script></body></html>";

    @BeforeEach
    void seedUsers() {
        ensureUser("tool_admin", UserRole.ADMIN, UserStatus.ACTIVE);
        ensureUser("tool_editor", UserRole.EDITOR, UserStatus.ACTIVE);
    }

    @Test
    void adminCreatesPublishedPublicToolAndItAppearsOnPublicListingAndRaw() throws Exception {
        String token = adminToken();

        MvcResult createResult = mockMvc.perform(multipart("/api/admin/tools")
                        .param("title", "SQL Tuning Checklist")
                        .param("slug", "sql-tuning-checklist")
                        .param("category", "Database")
                        .param("tags", "sql,performance")
                        .param("excerpt", "10 checks for slow queries")
                        .param("htmlSource", SAMPLE_HTML)
                        .param("status", "PUBLISHED")
                        .param("visibility", "PUBLIC")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value("sql-tuning-checklist"))
                .andExpect(jsonPath("$.status").value("PUBLISHED"))
                .andExpect(jsonPath("$.tags[0]").value("sql"))
                .andReturn();
        JsonNode created = objectMapper.readTree(createResult.getResponse().getContentAsString());

        mockMvc.perform(get("/api/tools"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("sql-tuning-checklist"));

        mockMvc.perform(get("/api/tools/sql-tuning-checklist/raw"))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/html;charset=UTF-8"))
                .andExpect(content().string(SAMPLE_HTML))
                .andExpect(header().string("X-Frame-Options", "SAMEORIGIN"))
                .andExpect(header().string("Content-Security-Policy", "frame-ancestors 'self'"));

        // Admin detail load includes the source; public list/detail never do.
        mockMvc.perform(get("/api/admin/tools/{id}", created.get("id").asLong())
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.htmlSource").value(SAMPLE_HTML));
    }

    @Test
    void draftToolIsHiddenFromPublicListingAndRawReturns404() throws Exception {
        String token = adminToken();
        createTool(token, "draft-tool", "DRAFT", "PUBLIC");

        // Not an exact-length assertion — other tests in this class leave their own
        // published/public tools in the (shared, non-transactional) test database, so
        // only this test's own slug is a state-independent thing to check.
        mockMvc.perform(get("/api/tools"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].slug", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("draft-tool"))));

        mockMvc.perform(get("/api/tools/draft-tool/raw"))
                .andExpect(status().isNotFound());
    }

    @Test
    void privateToolRawReturns404ForAnonymous() throws Exception {
        String token = adminToken();
        createTool(token, "private-tool", "PUBLISHED", "PRIVATE");

        mockMvc.perform(get("/api/tools/private-tool/raw"))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/tools"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[*].slug", org.hamcrest.Matchers.not(org.hamcrest.Matchers.hasItem("private-tool"))));
    }

    @Test
    void createWithoutAdminRoleIsRejected() throws Exception {
        String editorToken = tokenFor("tool_editor", "Passw0rd!");

        mockMvc.perform(multipart("/api/admin/tools")
                        .param("title", "t")
                        .param("slug", "editor-tool")
                        .param("htmlSource", SAMPLE_HTML)
                        .param("status", "DRAFT")
                        .header("Authorization", "Bearer " + editorToken))
                .andExpect(status().isForbidden());
    }

    @Test
    void createWithoutHtmlSourceIsRejected() throws Exception {
        String token = adminToken();

        mockMvc.perform(multipart("/api/admin/tools")
                        .param("title", "t")
                        .param("slug", "no-html-tool")
                        .param("htmlSource", "")
                        .param("status", "DRAFT")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void updateWithBlankHtmlSourceLeavesExistingSourceUntouched() throws Exception {
        String token = adminToken();
        JsonNode created = createTool(token, "keep-source-tool", "PUBLISHED", "PUBLIC");
        long id = created.get("id").asLong();

        mockMvc.perform(multipart(HttpMethod.PUT, "/api/admin/tools/{id}", id)
                        .param("title", "Renamed title")
                        .param("slug", "keep-source-tool")
                        .param("htmlSource", "")
                        .param("status", "PUBLISHED")
                        .param("visibility", "PUBLIC")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Renamed title"));

        mockMvc.perform(get("/api/tools/keep-source-tool/raw"))
                .andExpect(status().isOk())
                .andExpect(content().string(SAMPLE_HTML));
    }

    @Test
    void deletingToolRemovesItAndSubsequentRawIs404() throws Exception {
        String token = adminToken();
        JsonNode created = createTool(token, "delete-me-tool", "PUBLISHED", "PUBLIC");
        long id = created.get("id").asLong();

        mockMvc.perform(delete("/api/admin/tools/{id}", id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tools/delete-me-tool/raw"))
                .andExpect(status().isNotFound());
    }

    @Test
    void recordViewIncrementsPublicViewCount() throws Exception {
        String token = adminToken();
        createTool(token, "viewed-tool", "PUBLISHED", "PUBLIC");

        mockMvc.perform(post("/api/tools/viewed-tool/view"))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/tools/viewed-tool"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.viewCount").value(1));
    }

    // --- cover-image visibility (ToolService.getCoverImageTool) ---

    @Test
    void coverImageOfPublishedPublicToolIsServedAnonymously() throws Exception {
        String token = adminToken();
        long id = createToolWithCoverImage(token, "cover-public-tool", "PUBLISHED", "PUBLIC")
                .get("id").asLong();

        mockMvc.perform(get("/api/tools/{id}/cover-image", id))
                .andExpect(status().isOk())
                .andExpect(header().string("Content-Type", "image/jpeg"));
    }

    @Test
    void coverImageOfPrivateToolIs404ForAnonymousButOkForAdmin() throws Exception {
        String token = adminToken();
        long id = createToolWithCoverImage(token, "cover-private-tool", "PUBLISHED", "PRIVATE")
                .get("id").asLong();

        mockMvc.perform(get("/api/tools/{id}/cover-image", id))
                .andExpect(status().isNotFound());

        mockMvc.perform(get("/api/tools/{id}/cover-image", id)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void coverImageOfDraftToolIs404ForAnonymous() throws Exception {
        String token = adminToken();
        long id = createToolWithCoverImage(token, "cover-draft-tool", "DRAFT", "PUBLIC")
                .get("id").asLong();

        mockMvc.perform(get("/api/tools/{id}/cover-image", id))
                .andExpect(status().isNotFound());
    }

    // --- helpers ---

    private JsonNode createTool(String token, String slug, String status, String visibility) throws Exception {
        MvcResult result = mockMvc.perform(multipart("/api/admin/tools")
                        .param("title", "Tool " + slug)
                        .param("slug", slug)
                        .param("htmlSource", SAMPLE_HTML)
                        .param("status", status)
                        .param("visibility", visibility)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    private JsonNode createToolWithCoverImage(String token, String slug, String status, String visibility)
            throws Exception {
        MockMultipartFile coverImage = new MockMultipartFile(
                "coverImage", "cover.jpg", "image/jpeg", minimalJpegBytes());
        MvcResult result = mockMvc.perform(MockMvcRequestBuilders.multipart("/api/admin/tools")
                        .file(coverImage)
                        .param("title", "Tool " + slug)
                        .param("slug", slug)
                        .param("htmlSource", SAMPLE_HTML)
                        .param("status", status)
                        .param("visibility", visibility)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString());
    }

    /** Minimal valid JPEG bytes (SOI + EOI markers) — same fixture as PostCoverImageTest. */
    private byte[] minimalJpegBytes() {
        return new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9};
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
        return tokenFor("tool_admin", "Passw0rd!");
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
}
