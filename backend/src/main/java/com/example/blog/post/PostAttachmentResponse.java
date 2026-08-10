package com.example.blog.post;

import java.time.Instant;

public record PostAttachmentResponse(
        Long id,
        String originalFilename,
        String contentType,
        AttachmentType attachmentType,
        long fileSize,
        Instant uploadedAt,
        String url
) {
    static PostAttachmentResponse from(PostAttachment attachment) {
        return new PostAttachmentResponse(
                attachment.getId(),
                attachment.getOriginalFilename(),
                attachment.getContentType(),
                attachment.getAttachmentType(),
                attachment.getFileSize(),
                attachment.getUploadedAt(),
                "/api/posts/" + attachment.getPost().getId() + "/attachments/" + attachment.getId()
        );
    }
}
