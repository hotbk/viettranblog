package com.example.blog.video;

import com.example.blog.common.NotFoundException;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.Set;
import java.util.UUID;

@RestController
public class ContentVideoController {

    // Raw upload ceiling, enforced before transcoding starts (abuse/resource guard).
    // The stored (transcoded) file is expected to land well under this.
    // Package-private (not private) so tests can assert against these without duplicating them.
    static final long MAX_RAW_SIZE = 200L * 1024 * 1024; // 200 MB
    static final int MAX_DURATION_SECONDS = 10 * 60; // 10 minutes
    private static final Set<String> ALLOWED_TYPES = Set.of(
            "video/mp4", "video/quicktime", "video/webm", "video/x-matroska", "video/x-msvideo"
    );
    private static final String OUTPUT_CONTENT_TYPE = "video/mp4";

    private final ContentVideoRepository videoRepository;
    private final VideoTranscoder transcoder;

    public ContentVideoController(ContentVideoRepository videoRepository, VideoTranscoder transcoder) {
        this.videoRepository = videoRepository;
        this.transcoder = transcoder;
    }

    public record VideoUploadResponse(String id, String url, int durationSeconds, long size) {}

    @PostMapping("/api/admin/videos")
    @ResponseStatus(HttpStatus.CREATED)
    public VideoUploadResponse upload(@RequestParam("file") MultipartFile file) {
        String contentType = file.getContentType();
        if (contentType == null || !ALLOWED_TYPES.contains(contentType)) {
            throw new IllegalArgumentException("Invalid video type. Allowed: mp4, mov, webm, mkv, avi");
        }
        if (file.isEmpty()) {
            throw new IllegalArgumentException("Video file is empty");
        }
        if (file.getSize() > MAX_RAW_SIZE) {
            throw new IllegalArgumentException("Video exceeds 200 MB limit");
        }

        Path inputPath = null;
        Path outputPath = null;
        try {
            inputPath = Files.createTempFile("video-in-", extensionFor(contentType));
            file.transferTo(inputPath);

            int durationSeconds = transcoder.probeDurationSeconds(inputPath);
            if (durationSeconds > MAX_DURATION_SECONDS) {
                throw new IllegalArgumentException("Video exceeds 10 minute limit");
            }

            outputPath = Files.createTempFile("video-out-", ".mp4");
            transcoder.transcode(inputPath, outputPath);
            byte[] data = Files.readAllBytes(outputPath);

            ContentVideo video = new ContentVideo();
            video.setId(UUID.randomUUID().toString());
            video.setContentType(OUTPUT_CONTENT_TYPE);
            video.setOriginalFilename(sanitize(file.getOriginalFilename()));
            video.setSize((long) data.length);
            video.setDurationSeconds(durationSeconds);
            video.setUploadedAt(LocalDateTime.now());
            video.setData(data);
            videoRepository.save(video);

            return new VideoUploadResponse(video.getId(), "/api/videos/" + video.getId(),
                    durationSeconds, data.length);
        } catch (IOException e) {
            throw new VideoProcessingException("Failed to process uploaded video: " + e.getMessage(), e);
        } finally {
            deleteQuietly(inputPath);
            deleteQuietly(outputPath);
        }
    }

    @GetMapping("/api/videos/{id}")
    public ResponseEntity<byte[]> serve(@PathVariable String id,
                                         @RequestHeader(value = "Range", required = false) String rangeHeader) {
        ContentVideo video = videoRepository.findById(id)
                .orElseThrow(() -> new NotFoundException("VIDEO_NOT_FOUND", "Video not found"));
        byte[] data = video.getData();
        long fileLength = data.length;
        MediaType mediaType = MediaType.parseMediaType(video.getContentType());

        if (rangeHeader == null) {
            return ResponseEntity.ok()
                    .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                    .contentType(mediaType)
                    .contentLength(fileLength)
                    .body(data);
        }

        long[] range = parseRange(rangeHeader, fileLength);
        if (range == null) {
            return ResponseEntity.status(HttpStatus.REQUESTED_RANGE_NOT_SATISFIABLE)
                    .header(HttpHeaders.CONTENT_RANGE, "bytes */" + fileLength)
                    .build();
        }
        long start = range[0];
        long end = range[1];
        int sliceLength = (int) (end - start + 1);
        byte[] slice = Arrays.copyOfRange(data, (int) start, (int) start + sliceLength);

        return ResponseEntity.status(HttpStatus.PARTIAL_CONTENT)
                .header(HttpHeaders.ACCEPT_RANGES, "bytes")
                .header(HttpHeaders.CONTENT_RANGE, "bytes " + start + "-" + end + "/" + fileLength)
                .contentType(mediaType)
                .contentLength(sliceLength)
                .body(slice);
    }

    /** Parses a single-range "bytes=start-end" header. Returns null if malformed or out of bounds. */
    private static long[] parseRange(String rangeHeader, long fileLength) {
        if (!rangeHeader.startsWith("bytes=")) return null;
        String spec = rangeHeader.substring("bytes=".length()).split(",")[0].trim();
        String[] parts = spec.split("-", 2);
        if (parts.length != 2) return null;
        try {
            long start;
            long end;
            if (parts[0].isEmpty()) {
                // suffix range: last N bytes
                long suffixLength = Long.parseLong(parts[1]);
                start = Math.max(0, fileLength - suffixLength);
                end = fileLength - 1;
            } else {
                start = Long.parseLong(parts[0]);
                end = parts[1].isEmpty() ? fileLength - 1 : Long.parseLong(parts[1]);
            }
            if (start < 0 || end >= fileLength || start > end) return null;
            return new long[]{start, end};
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private static String extensionFor(String contentType) {
        return switch (contentType) {
            case "video/quicktime" -> ".mov";
            case "video/webm" -> ".webm";
            case "video/x-matroska" -> ".mkv";
            case "video/x-msvideo" -> ".avi";
            default -> ".mp4";
        };
    }

    private static void deleteQuietly(Path path) {
        if (path == null) return;
        try {
            Files.deleteIfExists(path);
        } catch (IOException ignored) {
            // best-effort cleanup; OS temp-dir GC is the fallback
        }
    }

    private static String sanitize(String filename) {
        if (filename == null) return null;
        return filename.replaceAll("[/\\\\]", "_");
    }
}
