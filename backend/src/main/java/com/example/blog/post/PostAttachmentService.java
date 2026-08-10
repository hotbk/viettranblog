package com.example.blog.post;

import com.example.blog.access.PostAccessService;
import com.example.blog.common.NotFoundException;
import com.example.blog.user.User;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Post attachment uploads/downloads (PDF/DOC/DOCX/TXT). Kept separate from
 * {@link PostService} — that class already assembles the read-side
 * {@code attachments} list on {@link PostResponse}; this one owns the
 * upload/delete/view mutations and their access checks.
 */
@Service
public class PostAttachmentService {

    // Documents are much smaller than the video feature's 200MB cap — 20MB
    // comfortably covers a PDF/DOCX for a blog post without inviting the same
    // DB-bloat-via-bytea risk already flagged for videos.
    static final long MAX_ATTACHMENT_SIZE = 20L * 1024 * 1024; // 20 MB

    private static final Map<String, AttachmentType> ALLOWED_CONTENT_TYPES = Map.of(
            "application/pdf", AttachmentType.PDF,
            "application/msword", AttachmentType.DOC,
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document", AttachmentType.DOCX,
            "text/plain", AttachmentType.TXT
    );

    private final PostAttachmentRepository attachmentRepository;
    private final PostRepository postRepository;
    private final PostAccessService postAccessService;

    public PostAttachmentService(PostAttachmentRepository attachmentRepository, PostRepository postRepository,
                                  PostAccessService postAccessService) {
        this.attachmentRepository = attachmentRepository;
        this.postRepository = postRepository;
        this.postAccessService = postAccessService;
    }

    @Transactional
    public PostAttachmentResponse upload(Long postId, MultipartFile file) {
        Post post = postRepository.findById(postId)
                .orElseThrow(() -> new NotFoundException("POST_NOT_FOUND", "Post not found"));

        if (file == null || file.isEmpty()) {
            throw new IllegalArgumentException("Attachment file is empty");
        }
        String contentType = file.getContentType();
        AttachmentType type = contentType == null ? null : ALLOWED_CONTENT_TYPES.get(contentType);
        if (type == null) {
            throw new IllegalArgumentException(
                    "Invalid attachment type. Allowed types: PDF, DOC, DOCX, TXT");
        }
        if (file.getSize() > MAX_ATTACHMENT_SIZE) {
            throw new IllegalArgumentException("Attachment exceeds maximum allowed size of 20 MB");
        }

        PostAttachment attachment = new PostAttachment();
        attachment.setPost(post);
        attachment.setContentType(contentType);
        attachment.setAttachmentType(type);
        attachment.setOriginalFilename(sanitizeFilename(file.getOriginalFilename()));
        attachment.setFileSize(file.getSize());
        try {
            attachment.setData(file.getBytes());
        } catch (IOException e) {
            throw new IllegalArgumentException("Failed to read attachment file: " + e.getMessage());
        }
        return PostAttachmentResponse.from(attachmentRepository.save(attachment));
    }

    @Transactional
    public void delete(Long postId, Long attachmentId) {
        PostAttachment attachment = attachmentRepository.findByIdAndPostId(attachmentId, postId)
                .orElseThrow(() -> new NotFoundException("ATTACHMENT_NOT_FOUND", "Attachment not found"));
        attachmentRepository.delete(attachment);
    }

    @Transactional(readOnly = true)
    public List<PostAttachmentResponse> list(Long postId) {
        return attachmentRepository.findByPostIdOrderByUploadedAtAsc(postId).stream()
                .map(PostAttachmentResponse::from)
                .toList();
    }

    /**
     * Fetch for the public view/download endpoint. Gated by the parent post's
     * visibility — same rule as the post itself, so a private post's
     * attachments are exactly as protected as its content. Plain 404 (not a
     * reason-coded 403) on denial, same oracle-avoidance call as
     * {@code PostService.getCoverImagePost}.
     */
    @Transactional(readOnly = true)
    public PostAttachment getForView(Long postId, Long attachmentId) {
        PostAttachment attachment = attachmentRepository.findByIdAndPostId(attachmentId, postId)
                .orElseThrow(() -> new NotFoundException("ATTACHMENT_NOT_FOUND", "Attachment not found"));
        User currentUser = postAccessService.currentUserOrNull();
        if (!postAccessService.canRead(currentUser, attachment.getPost())) {
            throw new NotFoundException("ATTACHMENT_NOT_FOUND", "Attachment not found");
        }
        return attachment;
    }

    private static String sanitizeFilename(String filename) {
        if (filename == null) {
            return "attachment";
        }
        String sanitized = filename.replaceAll("[/\\\\]", "_");
        if (sanitized.length() > 255) {
            sanitized = sanitized.substring(sanitized.length() - 255);
        }
        return sanitized;
    }
}
