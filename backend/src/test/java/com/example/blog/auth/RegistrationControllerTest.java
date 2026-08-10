package com.example.blog.auth;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import com.example.blog.user.UserStatus;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class RegistrationControllerTest {

    @Autowired MockMvc mockMvc;
    @Autowired UserRepository userRepository;

    @Test
    void registerCreatesAPendingMember() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"reg_user_1\",\"email\":\"reg1@test.local\",\"password\":\"Passw0rd!\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("MEMBER"))
                .andExpect(jsonPath("$.status").value("PENDING"));

        User created = userRepository.findByUsername("reg_user_1").orElseThrow();
        assertThat(created.getRole()).isEqualTo(UserRole.MEMBER);
        assertThat(created.getStatus()).isEqualTo(UserStatus.PENDING);
    }

    // Regression test for the IDOR risk flagged during design: RegisterRequest
    // has no role/status field at all, so even a caller that tries to smuggle
    // one into the JSON body is silently ignored, never bound.
    @Test
    void registerIgnoresClientSuppliedRoleAndStatus() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"reg_user_2\",\"email\":\"reg2@test.local\","
                                + "\"password\":\"Passw0rd!\",\"role\":\"ADMIN\",\"status\":\"ACTIVE\"}"))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.role").value("MEMBER"))
                .andExpect(jsonPath("$.status").value("PENDING"));

        User created = userRepository.findByUsername("reg_user_2").orElseThrow();
        assertThat(created.getRole()).isEqualTo(UserRole.MEMBER);
        assertThat(created.getStatus()).isEqualTo(UserStatus.PENDING);
    }

    @Test
    void registerRejectsDuplicateUsername() throws Exception {
        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"reg_user_3\",\"email\":\"reg3a@test.local\",\"password\":\"Passw0rd!\"}"))
                .andExpect(status().isCreated());

        mockMvc.perform(post("/api/auth/register")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("{\"username\":\"reg_user_3\",\"email\":\"reg3b@test.local\",\"password\":\"Passw0rd!\"}"))
                .andExpect(status().isConflict())
                .andExpect(jsonPath("$.code").value("USERNAME_TAKEN"));
    }
}
