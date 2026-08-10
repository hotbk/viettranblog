package com.example.blog.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostUserPermissionRepository extends JpaRepository<PostUserPermission, Long> {
    List<PostUserPermission> findByPostId(Long postId);
    boolean existsByPostIdAndUserId(Long postId, Long userId);
    List<PostUserPermission> findByUserIdAndPostIdIn(Long userId, List<Long> postIds);
    void deleteByPostIdAndUserId(Long postId, Long userId);
    List<PostUserPermission> findByUserId(Long userId);
}
