package com.example.blog.post;

import com.example.blog.access.AccessGroupBrief;
import com.example.blog.access.AccessGroupService;
import com.example.blog.access.UserBrief;
import com.example.blog.common.TranslationLinkRequest;
import com.example.blog.user.UserService;
import java.util.List;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

@RestController
@RequestMapping("/api/admin/posts")
public class AdminPostController {
    private final PostService postService;
    private final AccessGroupService accessGroupService;
    private final UserService userService;
    private final PostAttachmentService postAttachmentService;

    public AdminPostController(PostService postService, AccessGroupService accessGroupService,
                                UserService userService, PostAttachmentService postAttachmentService) {
        this.postService = postService;
        this.accessGroupService = accessGroupService;
        this.userService = userService;
        this.postAttachmentService = postAttachmentService;
    }

    @GetMapping
    public List<PostResponse> listAll() {
        return postService.search(null, null, true, null);
    }

    // --- dual-language content (docs/10-multilingual-content.md §3.2) ---

    @PutMapping("/{id}/translation-link")
    public PostResponse linkTranslation(@PathVariable Long id, @RequestBody TranslationLinkRequest request) {
        return postService.linkTranslation(id, request.targetId());
    }

    @PostMapping("/{id}/translation-reviewed")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void markTranslationReviewed(@PathVariable Long id) {
        postService.markTranslationReviewed(id);
    }

    // --- attachments (PDF/DOC/DOCX/TXT/MD/ZIP) ---

    @GetMapping("/{id}/attachments")
    public List<PostAttachmentResponse> listAttachments(@PathVariable Long id) {
        return postAttachmentService.list(id);
    }

    @PostMapping(value = "/{id}/attachments", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    @ResponseStatus(HttpStatus.CREATED)
    public PostAttachmentResponse uploadAttachment(@PathVariable Long id,
                                                    @RequestParam("file") MultipartFile file) {
        return postAttachmentService.upload(id, file);
    }

    @DeleteMapping("/{id}/attachments/{attachmentId}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    public void deleteAttachment(@PathVariable Long id, @PathVariable Long attachmentId) {
        postAttachmentService.delete(id, attachmentId);
    }

    // --- private-post access management, surfaced from the post edit form (spec §8) ---

    @GetMapping("/{id}/access-groups")
    public List<AccessGroupBrief> getAccessGroups(@PathVariable Long id) {
        return accessGroupService.getPostAccessGroups(id);
    }

    @PutMapping("/{id}/access-groups")
    public List<AccessGroupBrief> setAccessGroups(@PathVariable Long id, @RequestBody List<Long> groupIds) {
        accessGroupService.setPostAccessGroups(id, groupIds);
        return accessGroupService.getPostAccessGroups(id);
    }

    @GetMapping("/{id}/access-users")
    public List<UserBrief> getAccessUsers(@PathVariable Long id) {
        return accessGroupService.getPostDirectUsers(id);
    }

    @PutMapping("/{id}/access-users")
    public List<UserBrief> setAccessUsers(@PathVariable Long id, @RequestBody List<Long> userIds) {
        accessGroupService.setPostDirectUsers(id, userIds, userService.currentUserIdOrNull());
        return accessGroupService.getPostDirectUsers(id);
    }
}
