package com.example.blog.auth;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.multipart;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class AuthControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired ObjectMapper objectMapper;
    @Autowired UserRepository userRepository;
    @Autowired PasswordEncoder passwordEncoder;

    @BeforeEach
    void seedAdminUser() {
        if (!userRepository.existsByUsername("admin")) {
            User admin = new User();
            admin.setUsername("admin");
            admin.setEmail("admin@test.local");
            admin.setPassword(passwordEncoder.encode("admin123"));
            admin.setRole(UserRole.ADMIN);
            userRepository.save(admin);
        }
    }

    // TC-1
    @Test
    void publicGetPostsRequiresNoAuth() throws Exception {
        mockMvc.perform(get("/api/posts"))
                .andExpect(status().isOk());
    }

    // TC-2
    @Test
    void publicGetHealthRequiresNoAuth() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk());
    }

    // TC-3
    @Test
    void createPostWithoutTokenReturns401() throws Exception {
        mockMvc.perform(multipart("/api/posts")
                        .param("title", "T")
                        .param("slug", "s")
                        .param("content", "C")
                        .param("status", "PUBLISHED"))
                .andExpect(status().isUnauthorized());
    }

    // TC-4
    @Test
    void putPostWithoutTokenReturns401() throws Exception {
        mockMvc.perform(multipart("/api/posts/999")
                        .param("title", "T")
                        .param("slug", "s")
                        .param("content", "C")
                        .param("status", "PUBLISHED"))
                .andExpect(status().isUnauthorized());
    }

    // TC-5
    @Test
    void deletePostWithoutTokenReturns401() throws Exception {
        mockMvc.perform(delete("/api/posts/999"))
                .andExpect(status().isUnauthorized());
    }

    // TC-6
    @Test
    void loginWithValidCredentialsReturnsToken() throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest("admin", "admin123"));
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").isNotEmpty())
                .andExpect(jsonPath("$.username").value("admin"))
                .andExpect(jsonPath("$.role").value("ADMIN"));
    }

    // TC-7
    @Test
    void loginWithInvalidCredentialsReturns401() throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest("admin", "wrongpassword"));
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isUnauthorized());
    }

    // TC-8
    @Test
    void createPostWithValidTokenReturns201() throws Exception {
        String token = obtainAdminToken();

        mockMvc.perform(multipart("/api/posts")
                        .param("title", "Auth Flow Test Post")
                        .param("slug", "auth-flow-test-post")
                        .param("excerpt", "Excerpt")
                        .param("content", "Content body")
                        .param("category", "Technology")
                        .param("tags", "test")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.slug").value("auth-flow-test-post"));
    }

    // TC-9: non-admin user cannot login to admin
    @Test
    void loginWithReaderRoleReturns403() throws Exception {
        if (!userRepository.existsByUsername("reader_test")) {
            User reader = new User();
            reader.setUsername("reader_test");
            reader.setEmail("reader@test.local");
            reader.setPassword(passwordEncoder.encode("reader123"));
            reader.setRole(UserRole.READER);
            userRepository.save(reader);
        }

        String body = objectMapper.writeValueAsString(new LoginRequest("reader_test", "reader123"));
        mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andExpect(status().isForbidden());
    }

    private String obtainAdminToken() throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest("admin", "admin123"));
        String response = mockMvc.perform(post("/api/auth/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(body))
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode node = objectMapper.readTree(response);
        return node.get("token").asText();
    }
}
