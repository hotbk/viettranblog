package com.example.blog.post;

import com.example.blog.common.ContentLanguage;
import java.util.List;
import org.springframework.http.ContentDisposition;
import org.springframework.http.HttpHeaders;
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
    private final PostAttachmentService postAttachmentService;

    public PostController(PostService postService, PostAttachmentService postAttachmentService) {
        this.postService = postService;
        this.postAttachmentService = postAttachmentService;
    }

    @GetMapping
    public List<PostResponse> search(@RequestParam(required = false) String q,
                                     @RequestParam(required = false) String category,
                                     @RequestParam(required = false) ContentLanguage language) {
        return postService.search(q, category, false, language);
    }

    @GetMapping("/{slug}")
    public PostResponse findBySlug(@PathVariable String slug) {
        return postService.findBySlug(slug);
    }

    @GetMapping("/{slug}/related")
    public List<RelatedPostResponse> related(@PathVariable String slug,
                                              @RequestParam(required = false) Integer limit) {
        return postService.findRelated(slug, limit);
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
            @RequestParam(defaultValue = "PUBLIC") PostVisibility visibility,
            @RequestParam(required = false) PostMetadataVisibility privateMetadataVisibility,
            @RequestPart(required = false) MultipartFile coverImage,
            @RequestParam(required = false) ContentLanguage language,
            @RequestParam(required = false) Long translationOfPostId) {

        List<String> tagList = parseTags(tags);
        PostRequest request = new PostRequest(title, slug, excerpt, content, category, tagList, status,
                visibility, privateMetadataVisibility, language, translationOfPostId);
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
            @RequestParam(defaultValue = "PUBLIC") PostVisibility visibility,
            @RequestParam(required = false) PostMetadataVisibility privateMetadataVisibility,
            @RequestPart(required = false) MultipartFile coverImage,
            @RequestParam(required = false, defaultValue = "false") boolean removeCoverImage,
            @RequestParam(required = false) ContentLanguage language) {

        List<String> tagList = parseTags(tags);
        PostRequest request = new PostRequest(title, slug, excerpt, content, category, tagList, status,
                visibility, privateMetadataVisibility, language, null);
        return postService.update(id, request, coverImage, removeCoverImage);
    }

    @PutMapping("/{id}/status")
    public PostResponse updateStatus(@PathVariable Long id, @RequestParam PostStatus status) {
        return postService.updateStatus(id, status);
    }

    @GetMapping("/{id}/cover-image")
    public ResponseEntity<byte[]> getCoverImage(@PathVariable Long id) {
        Post post = postService.getCoverImagePost(id);
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(post.getCoverImageContentType()))
                .body(post.getCoverImageData());
    }

    @GetMapping("/{id}/attachments/{attachmentId}")
    public ResponseEntity<byte[]> getAttachment(@PathVariable Long id, @PathVariable Long attachmentId) {
        PostAttachment attachment = postAttachmentService.getForView(id, attachmentId);
        // DOC (legacy binary format) and ZIP (archive) have no safe in-browser renderer in
        // this app — force a download instead of "inline" so the browser doesn't just show
        // a garbled prompt or try to render binary bytes as text.
        boolean noInlineRenderer = attachment.getAttachmentType() == AttachmentType.DOC
                || attachment.getAttachmentType() == AttachmentType.ZIP;
        ContentDisposition.Builder disposition = noInlineRenderer
                ? ContentDisposition.attachment()
                : ContentDisposition.inline();
        return ResponseEntity.ok()
                .contentType(MediaType.parseMediaType(attachment.getContentType()))
                .header(HttpHeaders.CONTENT_DISPOSITION,
                        disposition.filename(attachment.getOriginalFilename()).build().toString())
                .body(attachment.getData());
    }

    @PostMapping("/{slug}/view")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void recordView(@PathVariable String slug) {
        postService.recordView(slug);
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
