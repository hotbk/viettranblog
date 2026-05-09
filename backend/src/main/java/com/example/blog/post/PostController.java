package com.example.blog.post;

import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/posts")
public class PostController {

    private final PostService postService;

    public PostController(PostService postService) {
        this.postService = postService;
    }

    @GetMapping
    public List<PostResponse> search(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) String category) {
        return postService.search(q, category, false);
    }

    @GetMapping("/{slug}")
    public PostResponse findBySlug(@PathVariable String slug) {
        return postService.findBySlug(slug);
    }

    @PostMapping(consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PostResponse create(
            @RequestParam String title,
            @RequestParam String slug,
            @RequestParam(required = false) String excerpt,
            @RequestParam String content,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String tags,
            @RequestParam PostStatus status,
            @RequestPart(required = false) MultipartFile coverImage) {

        List<String> tagList = parseTags(tags);
        PostRequest request = new PostRequest(title, slug, excerpt, content, category, tagList, status);
        return postService.create(request, coverImage);
    }

    @PutMapping(value = "/{id}", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public PostResponse update(
            @PathVariable Long id,
            @RequestParam String title,
            @RequestParam String slug,
            @RequestParam(required = false) String excerpt,
            @RequestParam String content,
            @RequestParam(required = false) String category,
            @RequestParam(required = false) String tags,
            @RequestParam PostStatus status,
            @RequestPart(required = false) MultipartFile coverImage,
            @RequestParam(required = false, defaultValue = "false") boolean removeCoverImage) {

        List<String> tagList = parseTags(tags);
        PostRequest request = new PostRequest(title, slug, excerpt, content, category, tagList, status);
        return postService.update(id, request, coverImage, removeCoverImage);
    }

    @GetMapping("/{id}/cover-image")
    public ResponseEntity<byte[]> getCoverImage(@PathVariable Long id) {
        Post post = postService.getCoverImagePost(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(post.getCoverImageContentType()))
                .body(post.getCoverImageData());
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void delete(@PathVariable Long id) {
        postService.delete(id);
    }

    private static List<String> parseTags(String tags) {
        if (tags == null || tags.isBlank()) {
            return List.of();
        }
        return List.of(tags.split(",")).stream()
                .map(String::trim)
                .filter(t -> !t.isBlank())
                .toList();
    }
}
