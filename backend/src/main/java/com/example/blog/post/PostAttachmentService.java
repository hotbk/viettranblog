package com.example.blog.post;

import com.example.blog.access.PostAccessService;
import com.example.blog.common.NotFoundException;
import com.example.blog.user.User;
import java.io.IOException;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

/**
 * Post attachment uploads/downloads (PDF/DOC/DOCX/TXT/MD/ZIP). Kept separate
 * from {@link PostService} — that class already assembles the read-side
 * {@code attachments} list on {@link PostResponse}; this one owns the
 * upload/delete/view mutations and their access checks.
 */
@Service
public class PostAttachmentService {

    // Documents are much smaller than the video feature's 200MB cap — 20MB
    // comfortably covers a PDF/DOCX (or a small ZIP bundle) for a blog post
    // without inviting the same DB-bloat-via-bytea risk already flagged for videos.
    static final long MAX_ATTACHMENT_SIZE = 20L * 1024 * 1024; // 20 MB

    // Classification is by filename extension, not the browser-reported
    // Content-Type header: for .md in particular, many browsers/OSes have no
    // registered MIME type and send "" or a generic application/octet-stream,
    // which would reject every markdown upload if we trusted that header. The
    // extension is exactly as client-controlled as Content-Type was, so this
    // is no weaker a check — just one that actually works for .md.
    private static final Map<String, AttachmentType> ALLOWED_EXTENSIONS = Map.of(
            "pdf", AttachmentType.PDF,
            "doc", AttachmentType.DOC,
            "docx", AttachmentType.DOCX,
            "txt", AttachmentType.TXT,
            "md", AttachmentType.MD,
            "zip", AttachmentType.ZIP
    );

    // The Content-Type we store and later serve back on view/download — derived
    // from the classified type rather than echoing the client's (possibly
    // missing or wrong) header, so GET .../attachments/{id} always has a valid
    // media type to respond with.
    private static final Map<AttachmentType, String> CANONICAL_CONTENT_TYPES = Map.of(
            AttachmentType.PDF, "application/pdf",
            AttachmentType.DOC, "application/msword",
            AttachmentType.DOCX, "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            AttachmentType.TXT, "text/plain",
            AttachmentType.MD, "text/markdown",
            AttachmentType.ZIP, "application/zip"
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
        AttachmentType type = ALLOWED_EXTENSIONS.get(extractExtension(file.getOriginalFilename()));
        if (type == null) {
            throw new IllegalArgumentException(
                    "Invalid attachment type. Allowed types: PDF, DOC, DOCX, TXT, MD, ZIP");
        }
        if (file.getSize() > MAX_ATTACHMENT_SIZE) {
            throw new IllegalArgumentException("Attachment exceeds maximum allowed size of 20 MB");
        }

        PostAttachment attachment = new PostAttachment();
        attachment.setPost(post);
        attachment.setContentType(CANONICAL_CONTENT_TYPES.get(type));
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

    /** Lowercased extension without the dot, or "" if there isn't one (e.g. "README", "file."). */
    private static String extractExtension(String filename) {
        if (filename == null) {
            return "";
        }
        int dot = filename.lastIndexOf('.');
        if (dot < 0 || dot == filename.length() - 1) {
            return "";
        }
        return filename.substring(dot + 1).toLowerCase(Locale.ROOT);
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
