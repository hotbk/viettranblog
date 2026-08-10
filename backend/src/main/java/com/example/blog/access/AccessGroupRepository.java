package com.example.blog.access;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface AccessGroupRepository extends JpaRepository<AccessGroup, Long> {
    boolean existsBySlug(String slug);
    boolean existsBySlugAndIdNot(String slug, Long id);
    Optional<AccessGroup> findBySlug(String slug);
}
