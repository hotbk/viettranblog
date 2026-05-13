package com.example.blog.series;

import java.util.List;
import java.util.Optional;
import org.springframework.data.jpa.repository.JpaRepository;

public interface SeriesPostRepository extends JpaRepository<SeriesPost, Long> {
    List<SeriesPost> findBySeriesIdOrderByPositionAsc(Long seriesId);
    Optional<SeriesPost> findByPostId(Long postId);
    void deleteBySeriesId(Long seriesId);
}
