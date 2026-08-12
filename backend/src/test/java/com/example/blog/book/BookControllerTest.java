package com.example.blog.book;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.access.AccessGroup;
import com.example.blog.access.AccessGroupRepository;
import com.example.blog.access.BookAccessGroup;
import com.example.blog.access.BookAccessGroupRepository;
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

/** Upload validation, the private-book access ladder, file/download gates,
 * reading progress, and the delete-cascade regression (R5) — see
 * docs/08-book-library-module.md §9 BE-B6 for the intended matrix. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired AccessGroupRepository accessGroupRepository;
    @Autowired UserAccessGroupRepository userAccessGroupRepository;
    @Autowired BookAccessGroupRepository bookAccessGroupRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void seedUsers() {
        ensureUser("bk_admin", UserRole.ADMIN, UserStatus.ACTIVE);
        ensureUser("bk_member_ingroup", UserRole.MEMBER, UserStatus.ACTIVE);
        ensureUser("bk_member_nogroup", UserRole.MEMBER, UserStatus.ACTIVE);
    }

    @Test
    void uploadValidPdfSucceedsAndAppearsInAdminList() throws Exception {
        String token = adminToken();
        MockMultipartFile pdf = new MockMultipartFile("file", "book.pdf", "application/pdf", minimalPdfBytes());

        MvcResult result = mockMvc.perform(multipart("/api/admin/books")
                        .file(pdf)
                        .param("title", "Test Book PDF")
                        .param("slug", "bk-pdf-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileType").value("PDF"))
                .andExpect(jsonPath("$.fileUrl").exists())
                .andReturn();

        long id = extractId(result);
        JsonNode created = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(created.get("fileUrl").asText()).isEqualTo("/api/books/" + id + "/file");

        mockMvc.perform(get("/api/admin/books").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='bk-pdf-book')]").isNotEmpty());

        mockMvc.perform(get("/api/admin/books"))
                .andExpect(status().isUnauthorized()); // no token — admin list requires auth
    }

    @Test
    void uploadValidTxtSucceeds() throws Exception {
        String token = adminToken();
        MockMultipartFile txt = new MockMultipartFile("file", "book.txt", "text/plain", "Hello book".getBytes());

        mockMvc.perform(multipart("/api/admin/books")
                        .file(txt)
                        .param("title", "Test Book TXT")
                        .param("slug", "bk-txt-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileType").value("TXT"));
    }

    @Test
    void uploadValidMarkdownSucceedsAndIsServedAsPlainText() throws Exception {
        String token = adminToken();
        MockMultipartFile md = new MockMultipartFile(
                "file", "README.md", "application/octet-stream", "# Library\n\nHello".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/admin/books")
                        .file(md)
                        .param("title", "Test Book MD")
                        .param("slug", "bk-md-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileType").value("MD"))
                .andReturn();

        mockMvc.perform(get("/api/books/{id}/file", extractId(result)))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/plain"));
    }

    @Test
    void uploadValidDocxSucceedsAndNormalizesContentType() throws Exception {
        String token = adminToken();
        byte[] docxPackage = {'P', 'K', 3, 4, 1, 2, 3, 4};
        MockMultipartFile docx = new MockMultipartFile(
                "file", "guide.docx", "application/octet-stream", docxPackage);

        MvcResult result = mockMvc.perform(multipart("/api/admin/books")
                        .file(docx)
                        .param("title", "Test Book DOCX")
                        .param("slug", "bk-docx-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileType").value("DOCX"))
                .andReturn();

        mockMvc.perform(get("/api/books/{id}/file", extractId(result)))
                .andExpect(status().isOk())
                .andExpect(content().contentType(
                        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"));
    }

    @Test
    void uploadRejectsInvalidDocxSignature() throws Exception {
        String token = adminToken();
        MockMultipartFile fakeDocx = new MockMultipartFile(
                "file", "fake.docx", "application/octet-stream", "not a zip package".getBytes());

        mockMvc.perform(multipart("/api/admin/books")
                        .file(fakeDocx)
                        .param("title", "Fake DOCX")
                        .param("slug", "bk-fake-docx")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadValidShSucceeds() throws Exception {
        String token = adminToken();
        MockMultipartFile sh = new MockMultipartFile(
                "file", "backup.sh", "application/octet-stream", "#!/bin/sh\necho hello\n".getBytes());

        mockMvc.perform(multipart("/api/admin/books")
                        .file(sh)
                        .param("title", "Test Book SH")
                        .param("slug", "bk-sh-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileType").value("SH"));
    }

    @Test
    void uploadValidSqlSucceeds() throws Exception {
        String token = adminToken();
        // Content-Type here deliberately mimics what real browsers send for an
        // unrecognized extension — the server must not rely on it (see
        // BookService.ALLOWED_SCRIPT_EXTENSIONS).
        MockMultipartFile sql = new MockMultipartFile(
                "file", "dump.sql", "", "CREATE TABLE t (id INT);\n".getBytes());

        mockMvc.perform(multipart("/api/admin/books")
                        .file(sql)
                        .param("title", "Test Book SQL")
                        .param("slug", "bk-sql-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileType").value("SQL"));
    }

    @Test
    void uploadRejectsBinaryContentDisguisedWithShExtension() throws Exception {
        // A real extension allowlist match (.sh) is not enough on its own —
        // the plaintext/magic-byte check must still reject binary bytes.
        String token = adminToken();
        byte[] binary = {0x7F, 'E', 'L', 'F', 0, 0, 1, 2, 3};
        MockMultipartFile fakeSh = new MockMultipartFile("file", "evil.sh", "application/octet-stream", binary);

        mockMvc.perform(multipart("/api/admin/books")
                        .file(fakeSh)
                        .param("title", "Fake SH Book")
                        .param("slug", "bk-fakesh-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadOfShIgnoresClientContentTypeAndNormalizesToTextPlain() throws Exception {
        // Client claims application/pdf for a .sh file — extension governs
        // type detection, not Content-Type, and the stored Content-Type is
        // always normalized to text/plain regardless of what was sent.
        String token = adminToken();
        MockMultipartFile sh = new MockMultipartFile(
                "file", "script.sh", "application/pdf", "#!/bin/sh\necho hi\n".getBytes());

        MvcResult result = mockMvc.perform(multipart("/api/admin/books")
                        .file(sh)
                        .param("title", "Spoofed CT Book")
                        .param("slug", "bk-spoofed-ct-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.fileType").value("SH"))
                .andReturn();
        long id = extractId(result);

        mockMvc.perform(get("/api/books/{id}/file", id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("text/plain"));
    }

    @Test
    void fileAndDownloadResponsesSetNosniffHeader() throws Exception {
        String token = adminToken();
        long bookId = createBook(token, "bk-nosniff-book", "PUBLISHED", "PUBLIC", null, true);

        mockMvc.perform(get("/api/books/{id}/file", bookId))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));

        mockMvc.perform(get("/api/books/{id}/download", bookId))
                .andExpect(status().isOk())
                .andExpect(header().string("X-Content-Type-Options", "nosniff"));
    }

    @Test
    void uploadRejectsWhitespaceOnlySlugInsteadOfStoringItEmpty() throws Exception {
        // Regression test: found live via manual testing. A whitespace-only slug
        // passes HTML5 `required` client-side (non-zero length) and used to pass
        // the server's uniqueness check too (checked against the untrimmed value),
        // then got trimmed to "" on save — producing an unroutable /library/ link.
        String token = adminToken();
        MockMultipartFile pdf = new MockMultipartFile("file", "book.pdf", "application/pdf", minimalPdfBytes());

        mockMvc.perform(multipart("/api/admin/books")
                        .file(pdf)
                        .param("title", "book")
                        .param("slug", "   ")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRejectsBlankTitle() throws Exception {
        String token = adminToken();
        MockMultipartFile pdf = new MockMultipartFile("file", "book.pdf", "application/pdf", minimalPdfBytes());

        mockMvc.perform(multipart("/api/admin/books")
                        .file(pdf)
                        .param("title", "  ")
                        .param("slug", "bk-blank-title-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRejectsDisallowedContentType() throws Exception {
        String token = adminToken();
        MockMultipartFile zip = new MockMultipartFile("file", "book.zip", "application/zip", new byte[]{1, 2, 3});

        mockMvc.perform(multipart("/api/admin/books")
                        .file(zip)
                        .param("title", "Bad Type Book")
                        .param("slug", "bk-badtype-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRejectsFileOver50MB() throws Exception {
        String token = adminToken();
        byte[] big = new byte[51 * 1024 * 1024];
        System.arraycopy("%PDF-".getBytes(), 0, big, 0, 5);
        MockMultipartFile pdf = new MockMultipartFile("file", "huge.pdf", "application/pdf", big);

        mockMvc.perform(multipart("/api/admin/books")
                        .file(pdf)
                        .param("title", "Huge Book")
                        .param("slug", "bk-huge-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadRejectsPdfFailingMagicByteCheck() throws Exception {
        String token = adminToken();
        // Claims application/pdf but the bytes don't start with %PDF-
        MockMultipartFile fake = new MockMultipartFile("file", "fake.pdf", "application/pdf", "not a pdf".getBytes());

        mockMvc.perform(multipart("/api/admin/books")
                        .file(fake)
                        .param("title", "Fake PDF Book")
                        .param("slug", "bk-fakepdf-book")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    @Test
    void uploadWithoutAuthIsRejected() throws Exception {
        MockMultipartFile pdf = new MockMultipartFile("file", "book.pdf", "application/pdf", minimalPdfBytes());

        mockMvc.perform(multipart("/api/admin/books")
                        .file(pdf)
                        .param("title", "No Auth Book")
                        .param("slug", "bk-noauth-book")
                        .param("status", "PUBLISHED"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void publicListHidesDraftBooks() throws Exception {
        String token = adminToken();
        createBook(token, "bk-draft-list-book", "DRAFT", "PUBLIC", null, true);

        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='bk-draft-list-book')]").isEmpty());
    }

    @Test
    void publicListOmitsAuthorizedOnlyPrivateBookFromNonGrantedViewer() throws Exception {
        String token = adminToken();
        createBook(token, "bk-hidden-book", "PUBLISHED", "PRIVATE", "AUTHORIZED_ONLY", true);

        mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.slug=='bk-hidden-book')]").isEmpty());
    }

    @Test
    void publicListShowsLockedTeaserForPublicMetadataPrivateBookAndOmitsFileUrl() throws Exception {
        String token = adminToken();
        createBook(token, "bk-teaser-book", "PUBLISHED", "PRIVATE", "PUBLIC_METADATA", true);

        MvcResult result = mockMvc.perform(get("/api/books"))
                .andExpect(status().isOk())
                .andReturn();
        JsonNode list = objectMapper.readTree(result.getResponse().getContentAsString());
        JsonNode teaser = findBySlug(list, "bk-teaser-book");
        assertThat(teaser.get("locked").asBoolean()).isTrue();
        assertThat(teaser.get("fileUrl").isNull()).isTrue();
        assertThat(teaser.get("downloadable").asBoolean()).isFalse();
    }

    private JsonNode findBySlug(JsonNode array, String slug) {
        for (JsonNode node : array) {
            if (slug.equals(node.get("slug").asText())) {
                return node;
            }
        }
        throw new AssertionError("No entry with slug " + slug);
    }

    @Test
    void findBySlugReturnsNoAccessForNonGrantedMemberThenSucceedsAfterGroupGrant() throws Exception {
        String token = adminToken();
        long bookId = createBook(token, "bk-slug-gate-book", "PUBLISHED", "PRIVATE", "PUBLIC_METADATA", false);
        grantGroupAccessToBook(bookId, "bk-slug-group");

        String outsiderToken = memberToken("bk_member_nogroup");
        mockMvc.perform(get("/api/books/bk-slug-gate-book").header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NO_ACCESS"));

        grantGroup("bk_member_ingroup", "bk-slug-group");
        String memberToken = memberToken("bk_member_ingroup");
        mockMvc.perform(get("/api/books/bk-slug-gate-book").header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.locked").value(false));
    }

    @Test
    void getFileIs404ForNonGrantedMemberAnd200WithInlineForGrantedMember() throws Exception {
        String token = adminToken();
        long bookId = createBook(token, "bk-file-gate-book", "PUBLISHED", "PRIVATE", "PUBLIC_METADATA", false);
        grantGroupAccessToBook(bookId, "bk-file-group");

        String outsiderToken = memberToken("bk_member_nogroup");
        mockMvc.perform(get("/api/books/{id}/file", bookId).header("Authorization", "Bearer " + outsiderToken))
                .andExpect(status().isNotFound());

        grantGroup("bk_member_ingroup", "bk-file-group");
        String memberToken = memberToken("bk_member_ingroup");
        mockMvc.perform(get("/api/books/{id}/file", bookId).header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(content().contentType("application/pdf"))
                .andExpect(header().string("Content-Disposition", org.hamcrest.Matchers.containsString("inline")));
    }

    @Test
    void downloadReturns403WhenNotDownloadable() throws Exception {
        String token = adminToken();
        long bookId = createBook(token, "bk-nodownload-book", "PUBLISHED", "PUBLIC", null, false);

        mockMvc.perform(get("/api/books/{id}/download", bookId))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("BOOK_NOT_DOWNLOADABLE"));
    }

    @Test
    void putProgressWithoutAuthIsRejected() throws Exception {
        String token = adminToken();
        long bookId = createBook(token, "bk-progress-noauth-book", "PUBLISHED", "PUBLIC", null, true);

        mockMvc.perform(put("/api/books/{id}/progress", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"position\":1,\"total\":10,\"unit\":\"PAGE\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void progressUpsertTwiceKeepsOneRowAndComputesPercent() throws Exception {
        String token = adminToken();
        long bookId = createBook(token, "bk-progress-book", "PUBLISHED", "PUBLIC", null, true);
        String memberToken = memberToken("bk_member_nogroup");

        mockMvc.perform(put("/api/books/{id}/progress", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + memberToken)
                        .content("{\"position\":5,\"total\":10,\"unit\":\"PAGE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.percent").value(50));

        mockMvc.perform(put("/api/books/{id}/progress", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + memberToken)
                        .content("{\"position\":9,\"total\":10,\"unit\":\"PAGE\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.percent").value(90));

        mockMvc.perform(get("/api/books/{id}/progress", bookId).header("Authorization", "Bearer " + memberToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.position").value(9));
    }

    @Test
    void progressRejectsWrongUnitForFileType() throws Exception {
        String token = adminToken();
        long bookId = createBook(token, "bk-progress-unit-book", "PUBLISHED", "PUBLIC", null, true); // PDF
        String memberToken = memberToken("bk_member_nogroup");

        mockMvc.perform(put("/api/books/{id}/progress", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + memberToken)
                        .content("{\"position\":50,\"total\":100,\"unit\":\"PERCENT\"}"))
                .andExpect(status().isBadRequest());
    }

    @Test
    void deletingBookWithFileGroupUserAndProgressSucceeds() throws Exception {
        // Regression test for R5 — this repo has shipped this exact FK-cleanup
        // bug twice already (post_attachments, and the underlying gap noted for
        // comments/access-groups/series). Delete must clean up all four tables.
        String token = adminToken();
        long bookId = createBook(token, "bk-cascade-delete-book", "PUBLISHED", "PRIVATE", "PUBLIC_METADATA", true);
        grantGroupAccessToBook(bookId, "bk-cascade-group");
        grantGroup("bk_member_ingroup", "bk-cascade-group");

        mockMvc.perform(put("/api/admin/books/{id}/access-users", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + token)
                        .content(objectMapper.writeValueAsString(
                                java.util.List.of(userRepository.findByUsername("bk_member_nogroup").orElseThrow().getId()))))
                .andExpect(status().isOk());

        String memberToken = memberToken("bk_member_ingroup");
        mockMvc.perform(put("/api/books/{id}/progress", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + memberToken)
                        .content("{\"position\":1,\"total\":10,\"unit\":\"PAGE\"}"))
                .andExpect(status().isOk());

        // createBook always uploads a PDF, so a PDF_RECTS highlight — this is the
        // single canonical "book with every dependent" fixture (see
        // docs/09-book-highlights-phase2.md §7.1); extended here rather than
        // duplicated into a second test.
        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + memberToken)
                        .content("""
                                {"anchorType":"PDF_RECTS","pageNumber":1,
                                 "rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.05}],
                                 "text":"cascade test highlight"}
                                """))
                .andExpect(status().isCreated());

        mockMvc.perform(delete("/api/admin/books/{id}", bookId).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    // --- helpers ---

    private long createBook(String token, String slug, String status, String visibility,
                             String metadataVisibility, boolean downloadable) throws Exception {
        MockMultipartFile pdf = new MockMultipartFile("file", "book.pdf", "application/pdf", minimalPdfBytes());
        var builder = multipart("/api/admin/books")
                .file(pdf)
                .param("title", "Book " + slug)
                .param("slug", slug)
                .param("status", status)
                .param("visibility", visibility)
                .param("downloadable", String.valueOf(downloadable))
                .header("Authorization", "Bearer " + token);
        if (metadataVisibility != null) {
            builder = builder.param("metadataVisibility", metadataVisibility);
        }
        MvcResult result = mockMvc.perform(builder)
                .andExpect(status().isCreated())
                .andReturn();
        return extractId(result);
    }

    private void grantGroupAccessToBook(long bookId, String groupSlug) {
        AccessGroup group = accessGroupRepository.findBySlug(groupSlug).orElseGet(() -> {
            AccessGroup g = new AccessGroup();
            g.setName(groupSlug);
            g.setSlug(groupSlug);
            g.setEnabled(true);
            return accessGroupRepository.save(g);
        });
        if (bookAccessGroupRepository.findByBookId(bookId).isEmpty()) {
            BookAccessGroup bag = new BookAccessGroup();
            bag.setBook(entityManagerFindBook(bookId));
            bag.setAccessGroup(group);
            bookAccessGroupRepository.save(bag);
        }
    }

    @Autowired BookRepository bookRepository;

    private Book entityManagerFindBook(long id) {
        return bookRepository.findById(id).orElseThrow();
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
        return tokenFor("bk_admin", "Passw0rd!");
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

    private long extractId(MvcResult result) throws Exception {
        String json = result.getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(json);
        return node.get("id").asLong();
    }

    private byte[] minimalPdfBytes() {
        return "%PDF-1.4\n%%EOF".getBytes();
    }
}
