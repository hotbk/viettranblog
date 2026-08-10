package com.example.blog.access;

import java.util.List;
import org.springframework.data.jpa.repository.JpaRepository;

public interface UserAccessGroupRepository extends JpaRepository<UserAccessGroup, Long> {
    List<UserAccessGroup> findByUserId(Long userId);
    List<UserAccessGroup> findByAccessGroupId(Long accessGroupId);
    boolean existsByUserIdAndAccessGroupId(Long userId, Long accessGroupId);
    void deleteByUserIdAndAccessGroupId(Long userId, Long accessGroupId);
    void deleteByAccessGroupId(Long accessGroupId);
    long countByAccessGroupId(Long accessGroupId);
}
