package com.example.blog.book;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
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
import java.time.Instant;
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

/** Book Library Phase 2 — highlights. See docs/09-book-highlights-phase2.md §11 BE-H4. */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class BookHighlightControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired AccessGroupRepository accessGroupRepository;
    @Autowired UserAccessGroupRepository userAccessGroupRepository;
    @Autowired BookAccessGroupRepository bookAccessGroupRepository;
    @Autowired BookRepository bookRepository;
    @Autowired BookHighlightRepository bookHighlightRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void seedUsers() {
        ensureUser("hl_admin", UserRole.ADMIN, UserStatus.ACTIVE);
        ensureUser("hl_member_a", UserRole.MEMBER, UserStatus.ACTIVE);
        ensureUser("hl_member_b", UserRole.MEMBER, UserStatus.ACTIVE);
    }

    @Test
    void createTxtHighlightSucceedsAndAppearsInBookList() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-txt-book");
        String member = memberToken("hl_member_a");

        MvcResult result = mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + member)
                        .content("""
                                {"anchorType":"TXT_OFFSET","startOffset":10,"endOffset":20,
                                 "text":"0123456789","note":"interesting"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.anchorType").value("TXT_OFFSET"))
                .andExpect(jsonPath("$.color").value("YELLOW"))
                .andExpect(jsonPath("$.stale").value(false))
                .andReturn();
        long highlightId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();

        mockMvc.perform(get("/api/books/{id}/highlights", bookId).header("Authorization", "Bearer " + member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(highlightId));
    }

    @Test
    void createPdfHighlightSucceeds() throws Exception {
        String token = adminToken();
        long bookId = createPdfBook(token, "hl-pdf-book");
        String member = memberToken("hl_member_a");

        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + member)
                        .content("""
                                {"anchorType":"PDF_RECTS","pageNumber":2,
                                 "rects":[{"x":0.1,"y":0.2,"w":0.3,"h":0.05}],
                                 "color":"GREEN","text":"a pdf highlight"}
                                """))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.pageNumber").value(2))
                .andExpect(jsonPath("$.color").value("GREEN"))
                .andExpect(jsonPath("$.rects[0].x").value(0.1));
    }

    @Test
    void wrongAnchorTypeForBookFileTypeIsRejected() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-wronganchor-book");
        String member = memberToken("hl_member_a");

        // PDF_RECTS on a TXT book
        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + member)
                        .content("""
                                {"anchorType":"PDF_RECTS","pageNumber":1,
                                 "rects":[{"x":0.1,"y":0.1,"w":0.1,"h":0.1}],"text":"x"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_HIGHLIGHT_ANCHOR"));
    }

    @Test
    void endOffsetNotGreaterThanStartOffsetIsRejected() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-badoffset-book");
        String member = memberToken("hl_member_a");

        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + member)
                        .content("""
                                {"anchorType":"TXT_OFFSET","startOffset":50,"endOffset":10,"text":"x"}
                                """))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("INVALID_HIGHLIGHT_ANCHOR"));
    }

    @Test
    void textOver2000CharsIsRejected() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-longtext-book");
        String member = memberToken("hl_member_a");
        String longText = "x".repeat(2001);

        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + member)
                        .content(objectMapper.writeValueAsString(new BookHighlightRequest(
                                HighlightAnchorType.TXT_OFFSET, 0, longText.length(), null, null, null, longText, null))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("HIGHLIGHT_TEXT_TOO_LONG"));
    }

    @Test
    void noteOver2000CharsIsRejected() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-longnote-book");
        String member = memberToken("hl_member_a");
        String longNote = "n".repeat(2001);

        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + member)
                        .content(objectMapper.writeValueAsString(new BookHighlightRequest(
                                HighlightAnchorType.TXT_OFFSET, 0, 5, null, null, null, "abcde", longNote))))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.code").value("HIGHLIGHT_NOTE_TOO_LONG"));
    }

    @Test
    void updateChangesOnlyTheNote() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-update-book");
        String member = memberToken("hl_member_a");
        long highlightId = createHighlight(bookId, member, 0, 5, "abcde", "first note");

        mockMvc.perform(put("/api/books/{id}/highlights/{hid}", bookId, highlightId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + member)
                        .content("{\"note\":\"updated note\"}"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.note").value("updated note"))
                .andExpect(jsonPath("$.text").value("abcde"))
                .andExpect(jsonPath("$.startOffset").value(0));
    }

    @Test
    void deleteHighlightReturns204() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-delete-book");
        String member = memberToken("hl_member_a");
        long highlightId = createHighlight(bookId, member, 0, 5, "abcde", null);

        mockMvc.perform(delete("/api/books/{id}/highlights/{hid}", bookId, highlightId)
                        .header("Authorization", "Bearer " + member))
                .andExpect(status().isNoContent());

        mockMvc.perform(get("/api/books/{id}/highlights", bookId).header("Authorization", "Bearer " + member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void anotherUsersHighlightIs404OnUpdateAndDeleteEvenForAdmin() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-otheruser-book");
        String ownerToken = memberToken("hl_member_a");
        long highlightId = createHighlight(bookId, ownerToken, 0, 5, "abcde", null);

        String otherMemberToken = memberToken("hl_member_b");
        mockMvc.perform(put("/api/books/{id}/highlights/{hid}", bookId, highlightId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + otherMemberToken)
                        .content("{\"note\":\"hijack\"}"))
                .andExpect(status().isNotFound())
                .andExpect(jsonPath("$.code").value("HIGHLIGHT_NOT_FOUND"));

        // Highlights are private to their creator, ADMIN included — no admin viewer/bypass.
        mockMvc.perform(delete("/api/books/{id}/highlights/{hid}", bookId, highlightId)
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void listWithoutAuthIsRejected() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-noauth-book");

        mockMvc.perform(get("/api/books/{id}/highlights", bookId))
                .andExpect(status().isUnauthorized());
        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"anchorType\":\"TXT_OFFSET\",\"startOffset\":0,\"endOffset\":1,\"text\":\"x\"}"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void noReadAccessToPrivateBookIsRejectedThenSucceedsAfterGrant() throws Exception {
        String token = adminToken();
        long bookId = createPrivateTxtBook(token, "hl-private-book", "hl-group");
        String outsider = memberToken("hl_member_b");

        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + outsider)
                        .content("{\"anchorType\":\"TXT_OFFSET\",\"startOffset\":0,\"endOffset\":3,\"text\":\"abc\"}"))
                .andExpect(status().isForbidden())
                .andExpect(jsonPath("$.code").value("NO_ACCESS"));

        grantGroup("hl_member_b", "hl-group");
        String memberAfterGrant = memberToken("hl_member_b");
        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + memberAfterGrant)
                        .content("{\"anchorType\":\"TXT_OFFSET\",\"startOffset\":0,\"endOffset\":3,\"text\":\"abc\"}"))
                .andExpect(status().isCreated());
    }

    @Test
    void quotaIsEnforced() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-quota-book");
        // Dedicated user — this test seeds 500 highlights and must not pollute
        // the shared hl_member_a/b accounts used by other tests in this class
        // (e.g. the /api/me/highlights count assertions).
        User owner = ensureUser("hl_member_quota", UserRole.MEMBER, UserStatus.ACTIVE);
        Book book = bookRepository.findById(bookId).orElseThrow();

        // Seed 500 rows directly (HTTP round trips would make this test slow) to
        // hit BookHighlightService.MAX_HIGHLIGHTS_PER_BOOK without exercising it.
        for (int i = 0; i < 500; i++) {
            BookHighlight h = new BookHighlight();
            h.setBook(book);
            h.setUser(owner);
            h.setFileVersion(book.getFileVersion());
            h.setAnchorType(HighlightAnchorType.TXT_OFFSET);
            h.setStartOffset(i);
            h.setEndOffset(i + 1);
            h.setColor(HighlightColor.YELLOW);
            h.setText("x");
            bookHighlightRepository.save(h);
        }

        String member = memberToken("hl_member_quota");
        mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + member)
                        .content("{\"anchorType\":\"TXT_OFFSET\",\"startOffset\":600,\"endOffset\":601,\"text\":\"x\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("HIGHLIGHT_LIMIT_REACHED"));
    }

    @Test
    void replacingBookFileFlagsHighlightsStaleInsteadOfDeletingThem() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-stale-book");
        String member = memberToken("hl_member_a");
        long highlightId = createHighlight(bookId, member, 0, 5, "abcde", "keep me");

        // Replace the file via the admin update endpoint.
        MockMultipartFile newFile = new MockMultipartFile("file", "book2.txt", "text/plain", "different content".getBytes());
        mockMvc.perform(multipart(org.springframework.http.HttpMethod.PUT, "/api/admin/books/{id}", bookId)
                        .file(newFile)
                        .param("title", "hl-stale-book")
                        .param("slug", "hl-stale-book")
                        .param("status", "PUBLISHED")
                        .param("visibility", "PUBLIC")
                        .param("downloadable", "true")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.fileType").value("TXT"));

        mockMvc.perform(get("/api/books/{id}/highlights", bookId).header("Authorization", "Bearer " + member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1))
                .andExpect(jsonPath("$[0].id").value(highlightId))
                .andExpect(jsonPath("$[0].stale").value(true))
                .andExpect(jsonPath("$[0].note").value("keep me"));
    }

    @Test
    void meHighlightsDropsBookWhoseGrantWasRevokedAndDraftBooks() throws Exception {
        String token = adminToken();
        long privateBookId = createPrivateTxtBook(token, "hl-me-private-book", "hl-me-group");
        // Dedicated user — this test asserts an exact count from /api/me/highlights,
        // so it must not share an account with tests that also create highlights
        // (e.g. hl_member_a is used across most of this file).
        ensureUser("hl_member_me", UserRole.MEMBER, UserStatus.ACTIVE);
        grantGroup("hl_member_me", "hl-me-group");
        String member = memberToken("hl_member_me");
        createHighlight(privateBookId, member, 0, 3, "abc", null);

        mockMvc.perform(get("/api/me/highlights").header("Authorization", "Bearer " + member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(1));

        // Revoke the group grant entirely.
        mockMvc.perform(put("/api/admin/books/{id}/access-groups", privateBookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + token)
                        .content("[]"))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/me/highlights").header("Authorization", "Bearer " + member))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.length()").value(0));
    }

    @Test
    void deletingUserWithAHighlightSucceeds() throws Exception {
        String token = adminToken();
        long bookId = createTxtBook(token, "hl-userdelete-book");
        User target = ensureUser("hl_delete_target", UserRole.MEMBER, UserStatus.ACTIVE);
        String targetToken = tokenFor("hl_delete_target", "Passw0rd!");
        createHighlight(bookId, targetToken, 0, 3, "abc", null);

        mockMvc.perform(delete("/api/admin/users/{id}", target.getId()).header("Authorization", "Bearer " + token))
                .andExpect(status().isNoContent());
    }

    // --- helpers ---

    private long createHighlight(long bookId, String token, int start, int end, String text, String note) throws Exception {
        String noteJson = note == null ? "null" : "\"" + note + "\"";
        MvcResult result = mockMvc.perform(post("/api/books/{id}/highlights", bookId)
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + token)
                        .content("{\"anchorType\":\"TXT_OFFSET\",\"startOffset\":" + start + ",\"endOffset\":" + end
                                + ",\"text\":\"" + text + "\",\"note\":" + noteJson + "}"))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private long createTxtBook(String token, String slug) throws Exception {
        MockMultipartFile txt = new MockMultipartFile("file", "book.txt", "text/plain", "0123456789abcdefghij".getBytes());
        MvcResult result = mockMvc.perform(multipart("/api/admin/books")
                        .file(txt)
                        .param("title", "Book " + slug)
                        .param("slug", slug)
                        .param("status", "PUBLISHED")
                        .param("visibility", "PUBLIC")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private long createPdfBook(String token, String slug) throws Exception {
        MockMultipartFile pdf = new MockMultipartFile("file", "book.pdf", "application/pdf", "%PDF-1.4\n%%EOF".getBytes());
        MvcResult result = mockMvc.perform(multipart("/api/admin/books")
                        .file(pdf)
                        .param("title", "Book " + slug)
                        .param("slug", slug)
                        .param("status", "PUBLISHED")
                        .param("visibility", "PUBLIC")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        return objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();
    }

    private long createPrivateTxtBook(String token, String slug, String groupSlug) throws Exception {
        MockMultipartFile txt = new MockMultipartFile("file", "book.txt", "text/plain", "0123456789".getBytes());
        MvcResult result = mockMvc.perform(multipart("/api/admin/books")
                        .file(txt)
                        .param("title", "Book " + slug)
                        .param("slug", slug)
                        .param("status", "PUBLISHED")
                        .param("visibility", "PRIVATE")
                        .param("metadataVisibility", "PUBLIC_METADATA")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();
        long bookId = objectMapper.readTree(result.getResponse().getContentAsString()).get("id").asLong();

        AccessGroup group = accessGroupRepository.findBySlug(groupSlug).orElseGet(() -> {
            AccessGroup g = new AccessGroup();
            g.setName(groupSlug);
            g.setSlug(groupSlug);
            g.setEnabled(true);
            return accessGroupRepository.save(g);
        });
        Book book = bookRepository.findById(bookId).orElseThrow();
        if (bookAccessGroupRepository.findByBookId(bookId).isEmpty()) {
            BookAccessGroup bag = new BookAccessGroup();
            bag.setBook(book);
            bag.setAccessGroup(group);
            bookAccessGroupRepository.save(bag);
        }
        return bookId;
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
        return tokenFor("hl_admin", "Passw0rd!");
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
}
