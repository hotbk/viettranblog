package com.example.blog.exam;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.access.AccessGroup;
import com.example.blog.access.AccessGroupRepository;
import com.example.blog.access.ExamAccessGroup;
import com.example.blog.access.ExamAccessGroupRepository;
import com.example.blog.access.ExamUserPermission;
import com.example.blog.access.ExamUserPermissionRepository;
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
 * End-to-end authorization matrix for private exams — mirrors
 * post.PostVisibilityControllerTest's approach (real HTTP + a real login),
 * but exercises the exam module's own, simpler "PUBLIC always readable /
 * PRIVATE requires assignment, denial is a plain 404" contract instead of
 * posts' richer reason-coded 401/403 responses.
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ExamAccessControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired ExamRepository examRepository;
    @Autowired AccessGroupRepository accessGroupRepository;
    @Autowired UserAccessGroupRepository userAccessGroupRepository;
    @Autowired ExamAccessGroupRepository examAccessGroupRepository;
    @Autowired ExamUserPermissionRepository examUserPermissionRepository;
    @Autowired PasswordEncoder passwordEncoder;

    private Exam publicExam;
    private Exam privateExam;
    private AccessGroup groupA;
    private AccessGroup groupB;

    @BeforeEach
    void setUp() {
        publicExam = ensureExam("EA Public Exam", ExamVisibility.PUBLIC);
        privateExam = ensureExam("EA Private Exam", ExamVisibility.PRIVATE);

        groupA = accessGroupRepository.findBySlug("ea-group-a").orElseGet(() -> {
            AccessGroup g = new AccessGroup();
            g.setName("EA Group A");
            g.setSlug("ea-group-a");
            g.setEnabled(true);
            return accessGroupRepository.save(g);
        });
        groupB = accessGroupRepository.findBySlug("ea-group-b").orElseGet(() -> {
            AccessGroup g = new AccessGroup();
            g.setName("EA Group B");
            g.setSlug("ea-group-b");
            g.setEnabled(true);
            return accessGroupRepository.save(g);
        });

        if (examAccessGroupRepository.findByExamId(privateExam.getId()).isEmpty()) {
            ExamAccessGroup eag = new ExamAccessGroup();
            eag.setExam(privateExam);
            eag.setAccessGroup(groupA);
            examAccessGroupRepository.save(eag);
        }

        ensureUser("ea_active_nomembership", UserStatus.ACTIVE);
        ensureUser("ea_active_groupa", UserStatus.ACTIVE);
        ensureUser("ea_active_groupb_only", UserStatus.ACTIVE);
        ensureUser("ea_active_direct", UserStatus.ACTIVE);
        ensureUser("ea_pending", UserStatus.PENDING);
        ensureUser("ea_suspended_ingroup", UserStatus.SUSPENDED);

        grantGroup("ea_active_groupa", groupA);
        grantGroup("ea_active_groupb_only", groupB);
        grantGroup("ea_suspended_ingroup", groupA);
        grantDirect("ea_active_direct", privateExam);
    }

    private Exam ensureExam(String title, ExamVisibility visibility) {
        return examRepository.findAll().stream()
                .filter(e -> title.equals(e.getTitle()))
                .findFirst()
                .orElseGet(() -> {
                    Exam e = new Exam();
                    e.setTitle(title);
                    e.setDescription("desc");
                    e.setStatus(ExamStatus.PUBLISHED);
                    e.setVisibility(visibility);
                    return examRepository.save(e);
                });
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

    private void grantDirect(String username, Exam exam) {
        User user = userRepository.findByUsername(username).orElseThrow();
        if (examUserPermissionRepository.existsByExamIdAndUserId(exam.getId(), user.getId())) {
            return;
        }
        ExamUserPermission perm = new ExamUserPermission();
        perm.setUser(user);
        perm.setExam(exam);
        examUserPermissionRepository.save(perm);
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

    // ── Public listing (anonymous, /api/exams) ──────────────────────────────

    @Test
    void publicListingIncludesPublicExamButNeverPrivateExam() throws Exception {
        mockMvc.perform(get("/api/exams"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + publicExam.getId() + ")]").exists())
                .andExpect(jsonPath("$[?(@.id==" + privateExam.getId() + ")]").doesNotExist());
    }

    // ── Member listing (/api/member/exams) ───────────────────────────────────

    @Test
    void memberWithoutAccessDoesNotSeePrivateExamInList() throws Exception {
        String token = tokenFor("ea_active_nomembership");
        mockMvc.perform(get("/api/member/exams").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + publicExam.getId() + ")]").exists())
                .andExpect(jsonPath("$[?(@.id==" + privateExam.getId() + ")]").doesNotExist());
    }

    @Test
    void memberInCorrectGroupSeesPrivateExamInList() throws Exception {
        String token = tokenFor("ea_active_groupa");
        mockMvc.perform(get("/api/member/exams").header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.id==" + privateExam.getId() + ")]").exists());
    }

    // ── Member exam detail (/api/member/exams/{id}) ─────────────────────────

    @Test
    void memberWithoutAccessGetsNotFoundOnPrivateExamDetail() throws Exception {
        String token = tokenFor("ea_active_nomembership");
        mockMvc.perform(get("/api/member/exams/" + privateExam.getId()).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void memberInWrongGroupGetsNotFoundOnPrivateExamDetail() throws Exception {
        String token = tokenFor("ea_active_groupb_only");
        mockMvc.perform(get("/api/member/exams/" + privateExam.getId()).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void suspendedMemberGetsNotFoundEvenWithStaleGroupMembership() throws Exception {
        String token = tokenFor("ea_suspended_ingroup");
        mockMvc.perform(get("/api/member/exams/" + privateExam.getId()).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void pendingMemberGetsNotFoundOnPrivateExamDetail() throws Exception {
        String token = tokenFor("ea_pending");
        mockMvc.perform(get("/api/member/exams/" + privateExam.getId()).header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void memberInCorrectGroupCanOpenPrivateExamDetail() throws Exception {
        String token = tokenFor("ea_active_groupa");
        mockMvc.perform(get("/api/member/exams/" + privateExam.getId()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("EA Private Exam"));
    }

    @Test
    void memberWithDirectGrantCanOpenPrivateExamDetail() throws Exception {
        String token = tokenFor("ea_active_direct");
        mockMvc.perform(get("/api/member/exams/" + privateExam.getId()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    @Test
    void anyMemberCanOpenPublicExamDetail() throws Exception {
        String token = tokenFor("ea_active_nomembership");
        mockMvc.perform(get("/api/member/exams/" + publicExam.getId()).header("Authorization", "Bearer " + token))
                .andExpect(status().isOk());
    }

    // ── Start attempt (/api/member/exams/{id}/attempts) — must be gated too, ──
    // ── not just the list/detail endpoints (defense against a direct POST). ──

    @Test
    void memberWithoutAccessCannotStartAttemptOnPrivateExam() throws Exception {
        String token = tokenFor("ea_active_nomembership");
        mockMvc.perform(post("/api/member/exams/" + privateExam.getId() + "/attempts")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isNotFound());
    }

    @Test
    void memberInCorrectGroupCanStartAttemptOnPrivateExam() throws Exception {
        String token = tokenFor("ea_active_groupa");
        mockMvc.perform(post("/api/member/exams/" + privateExam.getId() + "/attempts")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());
    }

    // ── Admin: managing exam <-> group / exam <-> user assignments ─────────

    @Test
    void adminCanReadAndReplaceExamAccessGroupsAndUsers() throws Exception {
        String adminToken = adminToken();

        mockMvc.perform(get("/api/admin/exams/" + privateExam.getId() + "/access-groups")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("ea-group-a"));

        mockMvc.perform(put("/api/admin/exams/" + privateExam.getId() + "/access-groups")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(groupB.getId()))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[0].slug").value("ea-group-b"));

        // restore groupA so the rest of the matrix (which runs in the same shared context) is unaffected
        mockMvc.perform(put("/api/admin/exams/" + privateExam.getId() + "/access-groups")
                        .header("Authorization", "Bearer " + adminToken)
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(List.of(groupA.getId()))))
                .andExpect(status().isOk());

        mockMvc.perform(get("/api/admin/exams/" + privateExam.getId() + "/access-users")
                        .header("Authorization", "Bearer " + adminToken))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$[?(@.username=='ea_active_direct')]").exists());
    }

    private String adminToken() throws Exception {
        userRepository.findByUsername("ea_admin").orElseGet(() -> {
            User u = new User();
            u.setUsername("ea_admin");
            u.setEmail("ea_admin@test.local");
            u.setPassword(passwordEncoder.encode("Passw0rd!"));
            u.setRole(UserRole.ADMIN);
            u.setStatus(UserStatus.ACTIVE);
            return userRepository.save(u);
        });
        return tokenFor("ea_admin");
    }
}
