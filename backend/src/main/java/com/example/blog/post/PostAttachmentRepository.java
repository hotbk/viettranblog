package com.example.blog.post;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostAttachmentRepository extends JpaRepository<PostAttachment, Long> {

    List<PostAttachment> findByPostIdOrderByUploadedAtAsc(Long postId);

    // Batched fetch for the admin listing (mirrors PostAccessGroupRepository.findByPostIdIn) —
    // avoids one query per row.
    List<PostAttachment> findByPostIdIn(List<Long> postIds);

    Optional<PostAttachment> findByIdAndPostId(Long id, Long postId);

    void deleteByPostId(Long postId);
}
