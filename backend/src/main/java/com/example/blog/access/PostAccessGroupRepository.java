package com.example.blog.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PostAccessGroupRepository extends JpaRepository<PostAccessGroup, Long> {
    List<PostAccessGroup> findByPostId(Long postId);
    List<PostAccessGroup> findByPostIdIn(List<Long> postIds);
    void deleteByPostId(Long postId);
    void deleteByAccessGroupId(Long accessGroupId);
    long countByAccessGroupId(Long accessGroupId);
}
