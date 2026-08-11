package com.example.blog.tool;

import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface ToolSourceRepository extends JpaRepository<ToolSource, Long> {
    Optional<ToolSource> findByToolId(Long toolId);

    @Modifying
    @Query("delete from ToolSource s where s.tool.id = :toolId")
    void deleteByToolId(@Param("toolId") Long toolId);
}
