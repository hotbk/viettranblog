package com.example.blog.video;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;

import com.example.blog.auth.LoginRequest;
import com.example.blog.user.User;
import com.example.blog.user.UserRepository;
import com.example.blog.user.UserRole;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.Assumptions;
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
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

import java.nio.file.Files;
import java.nio.file.Path;

/**
 * Requires ffmpeg/ffprobe on PATH — every test that exercises the actual transcode path
 * skips (via Assumptions) rather than failing when they're missing, since not every CI
 * runner has them installed yet (see VideoTranscoder javadoc / project memory follow-up).
 */
@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class ContentVideoControllerTest {

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

    // TC-1: reject a non-video content type → 400, no ffmpeg invoked
    @Test
    void rejectInvalidContentType() throws Exception {
        String token = obtainAdminToken();
        MockMultipartFile file = new MockMultipartFile("file", "notes.txt", "text/plain", "hello".getBytes());

        mockMvc.perform(MockMvcRequestBuilders.multipart("/api/admin/videos")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
    }

    // TC-2: reject an empty file → 400
    @Test
    void rejectEmptyFile() throws Exception {
        String token = obtainAdminToken();
        MockMultipartFile file = new MockMultipartFile("file", "empty.mp4", "video/mp4", new byte[0]);

        mockMvc.perform(MockMvcRequestBuilders.multipart("/api/admin/videos")
                        .file(file)
                        .header("Authorization", "Bearer " + token))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isBadRequest());
    }

    // TC-3: unauthenticated upload → 401
    @Test
    void rejectUnauthenticatedUpload() throws Exception {
        MockMultipartFile file = new MockMultipartFile("file", "clip.mp4", "video/mp4", new byte[]{1, 2, 3});

        mockMvc.perform(MockMvcRequestBuilders.multipart("/api/admin/videos").file(file))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isUnauthorized());
    }

    // TC-4: happy path — upload a tiny generated clip, transcode, then fetch it (full + ranged)
    @Test
    void uploadTranscodeAndServeWithRangeSupport() throws Exception {
        Assumptions.assumeTrue(ffmpegAvailable(), "ffmpeg/ffprobe not installed — skipping transcode test");

        Path clip = generateTestClip();
        try {
            String token = obtainAdminToken();
            MockMultipartFile file = new MockMultipartFile(
                    "file", "clip.mp4", "video/mp4", Files.readAllBytes(clip));

            MvcResult uploadResult = mockMvc.perform(MockMvcRequestBuilders.multipart("/api/admin/videos")
                            .file(file)
                            .header("Authorization", "Bearer " + token))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isCreated())
                    .andReturn();

            JsonNode body = objectMapper.readTree(uploadResult.getResponse().getContentAsString());
            String url = body.get("url").asText();
            assertThat(url).startsWith("/api/videos/");
            assertThat(body.get("durationSeconds").asInt()).isBetween(1, 5);
            assertThat(body.get("size").asLong()).isGreaterThan(0);

            // full fetch
            mockMvc.perform(get(url))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isOk())
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().string("Accept-Ranges", "bytes"))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.content().contentType("video/mp4"));

            // ranged fetch
            mockMvc.perform(get(url).header("Range", "bytes=0-99"))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().is(206))
                    .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.header().exists("Content-Range"));
        } finally {
            Files.deleteIfExists(clip);
        }
    }

    // TC-5: unknown video id → 404
    @Test
    void unknownVideoIdReturns404() throws Exception {
        mockMvc.perform(get("/api/videos/does-not-exist"))
                .andExpect(org.springframework.test.web.servlet.result.MockMvcResultMatchers.status().isNotFound());
    }

    // Regression guard: the documented upload limits haven't silently drifted.
    @Test
    void uploadLimitsMatchDocumentedValues() {
        assertThat(ContentVideoController.MAX_RAW_SIZE).isEqualTo(200L * 1024 * 1024);
        assertThat(ContentVideoController.MAX_DURATION_SECONDS).isEqualTo(600);
    }

    // --- helpers ---

    private String obtainAdminToken() throws Exception {
        String body = objectMapper.writeValueAsString(new LoginRequest("admin", "admin123"));
        String response = mockMvc.perform(
                        MockMvcRequestBuilders.post("/api/auth/login")
                                .contentType(MediaType.APPLICATION_JSON)
                                .content(body))
                .andReturn()
                .getResponse()
                .getContentAsString();
        JsonNode node = objectMapper.readTree(response);
        return node.get("token").asText();
    }

    private static boolean ffmpegAvailable() {
        try {
            return new ProcessBuilder("ffmpeg", "-version").start().waitFor() == 0
                    && new ProcessBuilder("ffprobe", "-version").start().waitFor() == 0;
        } catch (Exception e) {
            return false;
        }
    }

    /** Generates a ~1-second synthetic MP4 clip via ffmpeg's testsrc filter — fast, no external assets. */
    private static Path generateTestClip() throws Exception {
        Path out = Files.createTempFile("test-clip-", ".mp4");
        Process p = new ProcessBuilder(
                "ffmpeg", "-y", "-f", "lavfi", "-i", "testsrc=duration=1:size=64x64:rate=5",
                "-pix_fmt", "yuv420p", out.toString())
                .redirectErrorStream(true)
                .start();
        int exit = p.waitFor();
        if (exit != 0 || out.toFile().length() == 0) {
            throw new IllegalStateException("Failed to generate test clip for ffmpeg-dependent test");
        }
        return out;
    }
}
