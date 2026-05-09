package com.example.blog.post;

import static org.assertj.core.api.Assertions.assertThat;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
import org.springframework.http.HttpMethod;
import org.springframework.http.MediaType;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.MvcResult;
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders;

@SpringBootTest
@AutoConfigureMockMvc
@ActiveProfiles("test")
class PostCoverImageTest {

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

    // TC-1: create post without image → 201, hasCoverImage=false
    @Test
    void createPostWithoutImageSucceeds() throws Exception {
        String token = obtainAdminToken();

        mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .param("title", "No Image Post")
                        .param("slug", "no-image-post")
                        .param("content", "Some content")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hasCoverImage").value(false))
                .andExpect(jsonPath("$.coverImageUrl").doesNotExist());
    }

    // TC-2: create post with valid JPEG → 201, hasCoverImage=true, coverImageUrl not null
    @Test
    void createPostWithValidImageSucceeds() throws Exception {
        String token = obtainAdminToken();
        byte[] jpegBytes = minimalJpegBytes();

        MockMultipartFile imageFile = new MockMultipartFile(
                "coverImage", "cover.jpg", "image/jpeg", jpegBytes);

        MvcResult result = mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .file(imageFile)
                        .param("title", "Post With JPEG Cover")
                        .param("slug", "post-with-jpeg-cover")
                        .param("content", "Body text")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hasCoverImage").value(true))
                .andExpect(jsonPath("$.coverImageUrl").isNotEmpty())
                .andExpect(jsonPath("$.coverImageContentType").value("image/jpeg"))
                .andReturn();

        long id = extractId(result);
        String expectedUrl = "/api/posts/" + id + "/cover-image";
        JsonNode body = objectMapper.readTree(result.getResponse().getContentAsString());
        assertThat(body.get("coverImageUrl").asText()).isEqualTo(expectedUrl);
    }

    // TC-3: reject non-image file (text/plain) → 400
    @Test
    void rejectNonImageFile() throws Exception {
        String token = obtainAdminToken();

        MockMultipartFile textFile = new MockMultipartFile(
                "coverImage", "readme.txt", "text/plain", "hello".getBytes());

        mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .file(textFile)
                        .param("title", "Bad File Post")
                        .param("slug", "bad-file-post")
                        .param("content", "Body")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    // TC-4: reject file larger than 2 MB → 400
    @Test
    void rejectFileLargerThan2MB() throws Exception {
        String token = obtainAdminToken();
        byte[] bigFile = new byte[3 * 1024 * 1024]; // 3 MB

        MockMultipartFile imageFile = new MockMultipartFile(
                "coverImage", "large.jpg", "image/jpeg", bigFile);

        mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .file(imageFile)
                        .param("title", "Big Image Post")
                        .param("slug", "big-image-post")
                        .param("content", "Body")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isBadRequest());
    }

    // TC-5: GET /{id}/cover-image → 200, Content-Type: image/jpeg
    @Test
    void getCoverImageReturns200WithCorrectContentType() throws Exception {
        String token = obtainAdminToken();
        byte[] jpegBytes = minimalJpegBytes();

        MockMultipartFile imageFile = new MockMultipartFile(
                "coverImage", "snap.jpg", "image/jpeg", jpegBytes);

        MvcResult createResult = mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .file(imageFile)
                        .param("title", "Cover Image Fetch Post")
                        .param("slug", "cover-image-fetch-post")
                        .param("content", "Content")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();

        long id = extractId(createResult);

        mockMvc.perform(get("/api/posts/{id}/cover-image", id))
                .andExpect(status().isOk())
                .andExpect(content().contentType("image/jpeg"));
    }

    // TC-6: GET /{id}/cover-image on post without image → 404
    @Test
    void getCoverImageReturns404WhenNoImage() throws Exception {
        String token = obtainAdminToken();

        MvcResult createResult = mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .param("title", "No Cover Post")
                        .param("slug", "no-cover-post")
                        .param("content", "Content")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andReturn();

        long id = extractId(createResult);

        mockMvc.perform(get("/api/posts/{id}/cover-image", id))
                .andExpect(status().isNotFound());
    }

    // TC-7: GET /api/posts list does not contain "coverImageData" field
    @Test
    void listPostsDoesNotContainBinaryData() throws Exception {
        String token = obtainAdminToken();
        byte[] jpegBytes = minimalJpegBytes();

        MockMultipartFile imageFile = new MockMultipartFile(
                "coverImage", "thumb.jpg", "image/jpeg", jpegBytes);

        mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .file(imageFile)
                        .param("title", "List Binary Check Post")
                        .param("slug", "list-binary-check-post")
                        .param("content", "Content")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated());

        MvcResult listResult = mockMvc.perform(get("/api/posts"))
                .andExpect(status().isOk())
                .andReturn();

        String responseBody = listResult.getResponse().getContentAsString();
        assertThat(responseBody).doesNotContain("coverImageData");
    }

    // TC-8: create with image, then PUT removeCoverImage=true → hasCoverImage=false
    @Test
    void updatePostRemovesImageWhenFlagSet() throws Exception {
        String token = obtainAdminToken();
        byte[] jpegBytes = minimalJpegBytes();

        MockMultipartFile imageFile = new MockMultipartFile(
                "coverImage", "remove-me.jpg", "image/jpeg", jpegBytes);

        MvcResult createResult = mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .file(imageFile)
                        .param("title", "Remove Image Post")
                        .param("slug", "remove-image-post")
                        .param("content", "Content")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hasCoverImage").value(true))
                .andReturn();

        long id = extractId(createResult);

        mockMvc.perform(MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/posts/{id}", id)
                        .param("title", "Remove Image Post")
                        .param("slug", "remove-image-post")
                        .param("content", "Content")
                        .param("status", "PUBLISHED")
                        .param("removeCoverImage", "true")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasCoverImage").value(false));
    }

    // TC-9: create with image, PUT with new image → hasCoverImage=true, still works
    @Test
    void updatePostReplacesImage() throws Exception {
        String token = obtainAdminToken();
        byte[] jpegBytes = minimalJpegBytes();

        MockMultipartFile firstImage = new MockMultipartFile(
                "coverImage", "first.jpg", "image/jpeg", jpegBytes);

        MvcResult createResult = mockMvc.perform(MockMvcRequestBuilders.multipart("/api/posts")
                        .file(firstImage)
                        .param("title", "Replace Image Post")
                        .param("slug", "replace-image-post")
                        .param("content", "Content")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.hasCoverImage").value(true))
                .andReturn();

        long id = extractId(createResult);

        byte[] pngBytes = minimalPngBytes();
        MockMultipartFile secondImage = new MockMultipartFile(
                "coverImage", "second.png", "image/png", pngBytes);

        mockMvc.perform(MockMvcRequestBuilders.multipart(HttpMethod.PUT, "/api/posts/{id}", id)
                        .file(secondImage)
                        .param("title", "Replace Image Post")
                        .param("slug", "replace-image-post")
                        .param("content", "Content")
                        .param("status", "PUBLISHED")
                        .header("Authorization", "Bearer " + token))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.hasCoverImage").value(true))
                .andExpect(jsonPath("$.coverImageContentType").value("image/png"));
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

    private long extractId(MvcResult result) throws Exception {
        String json = result.getResponse().getContentAsString();
        JsonNode node = objectMapper.readTree(json);
        return node.get("id").asLong();
    }

    /** Minimal valid JPEG bytes (SOI + EOI markers). */
    private byte[] minimalJpegBytes() {
        return new byte[]{(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, (byte) 0xD9};
    }

    /** Minimal valid PNG bytes (PNG signature). */
    private byte[] minimalPngBytes() {
        return new byte[]{
                (byte) 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
                0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52
        };
    }
}
