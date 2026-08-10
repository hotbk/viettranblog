package com.example.blog.about;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.auth.LoginRequest;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
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

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class AboutControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;
    @Autowired AboutContentRepository aboutContentRepository;

    @BeforeEach
    void seedAdminAndResetAbout() {
        if (!userRepository.existsByUsername("about_admin")) {
            User admin = new User();
            admin.setUsername("about_admin");
            admin.setEmail("about_admin@test.local");
            admin.setPassword(passwordEncoder.encode("Passw0rd!"));
            admin.setRole(UserRole.ADMIN);
            userRepository.save(admin);
        }
        aboutContentRepository.deleteAll();
    }

    @Test
    void publicGetReturnsEmptyDefaultsBeforeAnyAdminSave() throws Exception {
        mockMvc.perform(get("/api/about"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value(""))
                .andExpect(jsonPath("$.content").value(""))
                .andExpect(jsonPath("$.updatedAt").doesNotExist());
    }

    @Test
    void adminUpdateThenPublicGetReflectsTheSavedContent() throws Exception {
        String token = adminToken();

        mockMvc.perform(put("/api/admin/about")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + token)
                        .content(objectMapper.writeValueAsString(new AboutRequest("About TECH2BLOGS", "We write about **software**."))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("About TECH2BLOGS"))
                .andExpect(jsonPath("$.content").value("We write about **software**."));

        mockMvc.perform(get("/api/about"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("About TECH2BLOGS"))
                .andExpect(jsonPath("$.content").value("We write about **software**."))
                .andExpect(jsonPath("$.updatedAt").exists());
    }

    @Test
    void updateWithoutAuthIsRejected() throws Exception {
        mockMvc.perform(put("/api/admin/about")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(new AboutRequest("x", "y"))))
                .andExpect(status().isUnauthorized());
    }

    @Test
    void savingTwiceUpdatesTheSameRowNotACopy() throws Exception {
        String token = adminToken();

        mockMvc.perform(put("/api/admin/about")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + token)
                        .content(objectMapper.writeValueAsString(new AboutRequest("First", "v1"))))
                .andExpect(status().isOk());

        mockMvc.perform(put("/api/admin/about")
                        .contentType(MediaType.APPLICATION_JSON)
                        .header("Authorization", "Bearer " + token)
                        .content(objectMapper.writeValueAsString(new AboutRequest("Second", "v2"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.title").value("Second"));

        org.assertj.core.api.Assertions.assertThat(aboutContentRepository.count()).isEqualTo(1);
    }

    private String adminToken() throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest("about_admin", "Passw0rd!"));
        String response = mockMvc.perform(org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn().getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(response);
        return node.get("token").asText();
    }
}
