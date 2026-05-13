package com.example.blog.image;

import com.example.blog.common.NotFoundException;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.time.LocalDateTime;
import java.util.Set;
import java.util.UUID;

@RestController
public class ContentImageController {

    private static final long MAX_SIZE = 5L * 1024 * 1024; // 5 MB
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "image/jpeg", "image/png", "image/webp", "image/gif"
    );

    private final ContentImageRepository imageRepository;

    public ContentImageController(ContentImageRepository imageRepository) {
        this.imageRepository = imageRepository;
    }

    public record ImageUploadResponse(String id, String url) {}

    @PostMapping("/api/admin/images")
    @ResponseStatus(HttpStatus.CREATED)
    public ImageUploadResponse upload(@RequestParam("file") MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Invalid image type. Allowed: jpeg, png, webp, gif");
        }
        if (file.getSize() > MAX_SIZE) {
            throw new IllegalArgumentException("Image exceeds 5 MB limit");
        }

        ContentImage img = new ContentImage();
        img.setId(UUID.randomUUID().toString());
        img.setContentType(contentType);
        img.setOriginalFilename(sanitize(file.getOriginalFilename()));
        img.setSize(file.getSize());
        img.setUploadedAt(LocalDateTime.now());
        try {
            img.setData(file.getBytes());
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read file: " + e.getMessage());
        }
        imageRepository.save(img);
        return new ImageUploadResponse(img.getId(), "/api/images/" + img.getId());
    }

    @GetMapping("/api/images/{id}")
    public ResponseEntity<byte[]> serve(@PathVariable String id) {
        ContentImage img = imageRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("IMAGE_NOT_FOUND", "Image not found"));
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(img.getContentType()))
                .body(img.getData());
    }

    private static String sanitize(String filename) {
        if (filename == null) return null;
        return filename.replaceAll("[/\\\\]", "_");
    }
}
