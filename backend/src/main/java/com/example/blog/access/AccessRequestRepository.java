package com.example.blog.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccessRequestRepository extends JpaRepository<AccessRequest, Long> {
    List<AccessRequest> findByUserIdOrderByCreatedAtDesc(Long userId);
    List<AccessRequest> findByStatusOrderByCreatedAtDesc(AccessRequestStatus status);
    boolean existsByUserIdAndPostIdAndStatus(Long userId, Long postId, AccessRequestStatus status);
}
